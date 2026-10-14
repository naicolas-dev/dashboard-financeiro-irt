import React, { useState, useMemo, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, InboxIcon, SignalSlashIcon } from '@heroicons/react/24/outline';
import TransactionRow from '../componentes/TransactionRow.jsx';
import ObligationActions from '../componentes/ObligationActions.jsx';
import ResponsiveDialog from '../componentes/ui/ResponsiveDialog.jsx';
import TransactionFlow from '../componentes/TransactionFlow.jsx';
import InvoicePaymentDialog from '../componentes/InvoicePaymentDialog.jsx';
import { ehPagamentoDeFatura } from '../dominio/cartoes.js';
import { ehLiquidacaoRecorrente } from '../dominio/recorrencias.js';
import EmptyState from '../componentes/ui/EmptyState.jsx';
import Skeleton from '../componentes/ui/Skeleton.jsx';
import ComboboxField from '../componentes/ui/ComboboxField.jsx';
import SelectField from '../componentes/ui/SelectField.jsx';
import { formatarCabecalhoData, formatarHora } from '../utils/datas.js';

const OPCOES_TIPO_FILTRO = [
  { valor: 'todos', texto: 'Receitas e despesas' },
  { valor: 'receita', texto: 'Só receitas' },
  { valor: 'despesa', texto: 'Só despesas' },
];

const PRESETS_PERIODO = [
  { id: 'este_mes', texto: 'Este mês' },
  { id: 'mes_passado', texto: 'Mês passado' },
  { id: 'ultimos_3_meses', texto: 'Últimos 3 meses' },
  { id: 'este_ano', texto: 'Este ano' },
];

function HistoricoSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

// Histórico completo (busca + filtros reaproveitados do useDadosFinanceiros). Cada
// linha tem botões de editar/excluir explícitos (TransactionRow com onEditar/onExcluir)
// — editar abre o TransactionFlow em modo edição (tela única, sem passar pelo teclado
// numérico); excluir vai direto, sem abrir nada (confirmação já embutida em
// `excluirTransacao`). Aqui só existe LIVRO-CAIXA: o que já aconteceu. Contas a pagar/receber
// (recorrências) moram em Home → Programadas; a quitação de uma delas aparece aqui como uma
// movimentação normal, mas editar/excluir leva ao fluxo da própria conta (nunca à edição
// genérica, que deixaria a conta "paga" sem pagamento).
const Movimentacoes = ({
  transacoes,
  transacoesFiltradas,
  filtros,
  setters,
  limparFiltros,
  carregando,
  erroCarregamento,
  excluirTransacao,
  handleTransacaoSalva,
  acoesProgramadas,
  ocorrenciaDaTransacao,
  programadas,
  cartoes,
  saldoFinanceiro,
  saldoDisponivel,
  handlePagamentoSalvo,
  contextoPagamento,
}) => {
  const { dataInicio, dataFim, filtroCategoria, filtroTipo } = filtros;
  const { setDataInicio, setDataFim, setFiltroCategoria, setFiltroTipo } = setters;

  const [busca, setBusca] = useState('');
  const [presetAtivo, setPresetAtivo] = useState(null);
  const [transacaoEditando, setTransacaoEditando] = useState(null);
  const [pagamentoEditando, setPagamentoEditando] = useState(null);
  const [liquidacaoEditando, setLiquidacaoEditando] = useState(null);

  // Pagamento de fatura não passa pelo fluxo genérico (não pode virar receita nem
  // trocar de categoria) — abre o diálogo próprio, com as regras do cartão.
  const editar = (t) => {
    if (ehPagamentoDeFatura(t)) setPagamentoEditando(t);
    else if (ehLiquidacaoRecorrente(t)) setLiquidacaoEditando(t);
    else setTransacaoEditando(t);
  };
  const ocorrenciaEditando = liquidacaoEditando ? ocorrenciaDaTransacao(liquidacaoEditando) : null;
  const contextoPagamentoEditando =
    pagamentoEditando &&
    contextoPagamento({ cartaoId: pagamentoEditando.cartaoId, competencia: pagamentoEditando.competencia, ignorarPagamentoId: pagamentoEditando.id });

  const categorias = useMemo(() => {
    const unicas = new Set();
    transacoes.forEach((t) => unicas.add(t.categoria));
    return [...unicas].sort();
  }, [transacoes]);

  const opcoesCategoria = useMemo(
    () => [{ valor: 'todas', texto: 'Todas categorias' }, ...categorias.map((c) => ({ valor: c, texto: c }))],
    [categorias]
  );

  const grupos = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    const filtradas = buscaLower
      ? transacoesFiltradas.filter(
          (t) => t.descricao.toLowerCase().includes(buscaLower) || t.categoria.toLowerCase().includes(buscaLower)
        )
      : transacoesFiltradas;

    const porData = new Map();
    for (const t of filtradas) {
      const chave = formatarCabecalhoData(t.data);
      if (!porData.has(chave)) porData.set(chave, []);
      porData.get(chave).push(t);
    }
    return [...porData.entries()];
  }, [transacoesFiltradas, busca]);

  const temFiltroAtivo = Boolean(dataInicio || dataFim || filtroCategoria !== 'todas' || filtroTipo !== 'todos' || busca.trim());

  const handlePresetClick = (presetId) => {
    const hoje = new Date();
    let inicio = new Date();
    let fim = new Date();

    switch (presetId) {
      case 'este_mes':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        break;
      case 'mes_passado':
        inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        break;
      case 'ultimos_3_meses':
        inicio.setMonth(hoje.getMonth() - 3);
        fim = hoje;
        break;
      case 'este_ano':
        inicio = new Date(hoje.getFullYear(), 0, 1);
        fim = hoje;
        break;
      default:
        break;
    }

    setDataInicio(inicio.toISOString().slice(0, 10));
    setDataFim(fim.toISOString().slice(0, 10));
    setPresetAtivo(presetId);
  };

  const handleLimparTudo = () => {
    limparFiltros();
    setBusca('');
    setPresetAtivo(null);
  };

  const fecharEdicao = useCallback(() => setTransacaoEditando(null), []);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Movimentações</h1>

      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição ou categoria"
            className="focus-ring w-full h-11 pl-10 pr-3.5 rounded-xl bg-surface-raised text-foreground placeholder:text-foreground-muted border border-border outline-none text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS_PERIODO.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset.id)}
                className={`focus-ring cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  presetAtivo === preset.id
                    ? 'bg-surface-active text-foreground'
                    : 'bg-surface-raised text-foreground-secondary border border-border hover:bg-surface-hover'
                }`}
              >
                {preset.texto}
              </button>
          ))}
          {temFiltroAtivo && (
            <button
              type="button"
              onClick={handleLimparTudo}
              className="focus-ring cursor-pointer flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-foreground-secondary hover:text-negative"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ComboboxField
            value={filtroCategoria}
            onChange={setFiltroCategoria}
            opcoes={opcoesCategoria}
            placeholder="Categoria"
            className="h-10"
          />
          <SelectField value={filtroTipo} onChange={setFiltroTipo} opcoes={OPCOES_TIPO_FILTRO} className="h-10" />
        </div>
      </div>

      <section className="space-y-4">
        {carregando ? (
          <HistoricoSkeleton />
        ) : grupos.length === 0 ? (
          erroCarregamento ? (
            <EmptyState icone={SignalSlashIcon} titulo="Sem conexão" descricao="Não foi possível carregar as transações." />
          ) : (
            <EmptyState
              icone={InboxIcon}
              titulo="Nenhuma transação encontrada"
              descricao="Ajuste a busca ou os filtros para ver outros lançamentos."
            />
          )
        ) : (
          grupos.map(([cabecalho, itens]) => (
            <div key={cabecalho} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted px-1">{cabecalho}</h2>
              <div className="rounded-2xl border border-border bg-surface-raised p-2 divide-y divide-border">
                {itens.map((t) => (
                  <TransactionRow
                    key={t.id}
                    descricao={t.descricao}
                    categoria={t.categoria}
                    dataFormatada={formatarHora(t.data)}
                    valor={t.valor}
                    tipo={t.tipo}
                    onEditar={() => editar(t)}
                    onExcluir={() => excluirTransacao(t.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <ResponsiveDialog aberto={!!transacaoEditando} aoFechar={fecharEdicao}>
        {transacaoEditando && (
          <TransactionFlow
            transacaoParaEditar={transacaoEditando}
            onFechar={fecharEdicao}
            onTransacaoSalva={handleTransacaoSalva}
            aoExcluir={excluirTransacao}
            cartoes={cartoes}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog aberto={!!pagamentoEditando} aoFechar={() => setPagamentoEditando(null)}>
        {pagamentoEditando && contextoPagamentoEditando && (
          <InvoicePaymentDialog
            cartao={contextoPagamentoEditando.cartao}
            competencia={pagamentoEditando.competencia}
            restanteFaturaCentavos={contextoPagamentoEditando.restanteFaturaCentavos}
            maximoCentavos={contextoPagamentoEditando.maximoCentavos}
            saldoFinanceiro={saldoFinanceiro}
            saldoDisponivel={saldoDisponivel}
            pagamentoParaEditar={pagamentoEditando}
            onSalvo={handlePagamentoSalvo}
            onExcluir={excluirTransacao}
            onFechar={() => setPagamentoEditando(null)}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog aberto={!!liquidacaoEditando} aoFechar={() => setLiquidacaoEditando(null)}>
        {liquidacaoEditando && ocorrenciaEditando && (
          <ObligationActions
            key={ocorrenciaEditando.id}
            ocorrencia={ocorrenciaEditando}
            agora={programadas.agora}
            liquidacao={liquidacaoEditando}
            acoes={acoesProgramadas}
            modoInicial="corrigir"
            onFechar={() => setLiquidacaoEditando(null)}
          />
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default Movimentacoes;
