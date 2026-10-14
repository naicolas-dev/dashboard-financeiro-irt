import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { SegmentGroup } from '@chakra-ui/react';
import { InboxIcon, SignalSlashIcon } from '@heroicons/react/24/outline';
import FinancialHero from '../componentes/FinancialHero.jsx';
import TransactionRow from '../componentes/TransactionRow.jsx';
import Programadas from '../componentes/Programadas.jsx';
import FloatingActionButton from '../componentes/FloatingActionButton.jsx';
import ResponsiveDialog from '../componentes/ui/ResponsiveDialog.jsx';
import TransactionFlow from '../componentes/TransactionFlow.jsx';
import RecurrenceFlow from '../componentes/RecurrenceFlow.jsx';
import EmptyState from '../componentes/ui/EmptyState.jsx';
import Skeleton from '../componentes/ui/Skeleton.jsx';
import { formatarDataRelativa } from '../utils/datas.js';

function HomeSkeleton() {
  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div className="rounded-[22px] bg-surface-raised border border-border p-5 sm:p-6 space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-6">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

// Única seção com tela completa nesta etapa. Dona do estado de scroll (colapso do
// Hero + visibilidade do FAB, uma única origem via IntersectionObserver) e do fluxo
// de nova transação — nenhum outro componente mexe nesse estado diretamente.
const Home = ({
  saldoFinanceiro,
  entradas,
  saidas,
  resultadoMes,
  transacoesRecentes: recentes,
  carregando,
  erroCarregamento,
  handleTransacaoSalva,
  recorrencias,
  programadas,
  acoesProgramadas,
  criarSerieRecorrente,
  editarSerieRecorrente,
  encerrarSerieRecorrente,
  excluirSerieRecorrente,
  podeExcluirSerieRecorrente,
  cartoes,
  handleCartaoSalvo,
  handleCompraCriada,
  metas,
  onAbrirCartoes,
  onAbrirMetas,
}) => {
  const sentinelRef = useRef(null);
  const [recolhido, setRecolhido] = useState(false);
  const [fluxoAberto, setFluxoAberto] = useState(false);
  const [tipoFluxo, setTipoFluxo] = useState(null);
  const [secaoHistorico, setSecaoHistorico] = useState('transacoes'); // 'transacoes' | 'programadas'
  const [recorrenciaEditando, setRecorrenciaEditando] = useState(null);
  const [recorrenteDialogAberto, setRecorrenteDialogAberto] = useState(false);
  const [tipoNovaRecorrencia, setTipoNovaRecorrencia] = useState('despesa');

  useEffect(() => {
    const elemento = sentinelRef.current;
    if (!elemento) return;

    // Observa um marcador fixo dentro do Hero (logo antes da grade de QuickActions
    // que colapsa), não o Hero inteiro — observar o próprio Hero cria um loop de
    // realimentação, porque a altura dele muda quando `recolhido` muda. O sentinel
    // "sai de vista" assim que cruza por baixo do header fixo (~64px do topo).
    const observer = new IntersectionObserver(
      ([entrada]) => setRecolhido(!entrada.isIntersecting),
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 }
    );
    observer.observe(elemento);
    return () => observer.disconnect();
    // `carregando` troca o Hero pelo skeleton e de volta, recriando o sentinel —
    // sem reanexar, o observer ficava preso no nó antigo (desanexado) e travava
    // `recolhido` no último valor.
  }, [carregando]);

  // Saldo, Entradas/Saídas (período do Hero), resultado do mês e "últimas realizadas"
  // vêm prontos do hook (domínio) — Home só exibe, não calcula regra financeira.

  // Atalho de menor fricção no Hero: a meta ainda não concluída com maior progresso.
  // Uma meta já concluída (valorReservado >= valorAlvo) não é "a mais próxima de
  // concluir" — já concluiu — então fica de fora da disputa.
  const metaDestaque = useMemo(() => {
    const ativas = metas.filter((m) => m.valorAlvo > 0 && m.valorReservado < m.valorAlvo);
    if (ativas.length === 0) return null;
    const maisProxima = ativas.reduce((a, b) => (b.valorReservado / b.valorAlvo > a.valorReservado / a.valorAlvo ? b : a));
    return { nome: maisProxima.nome, progresso: Math.round((maisProxima.valorReservado / maisProxima.valorAlvo) * 100) };
  }, [metas]);

  const abrirTransacao = useCallback((tipo) => {
    setTipoFluxo(tipo ?? null);
    setFluxoAberto(true);
  }, []);

  const fecharFluxo = useCallback(() => setFluxoAberto(false), []);

  const fecharRecorrenteDialog = useCallback(() => setRecorrenteDialogAberto(false), []);
  // Chamado pelas QuickActions Receita/Despesa do Hero quando `secaoHistorico` já
  // está em 'programadas' — nesse modo elas não abrem o TransactionFlow, abrem
  // direto a criação de uma regra recorrente já com o tipo certo.
  const abrirNovaRecorrencia = useCallback((tipo) => {
    setRecorrenciaEditando(null);
    setTipoNovaRecorrencia(tipo ?? 'despesa');
    setRecorrenteDialogAberto(true);
  }, []);
  const abrirEditarRecorrencia = useCallback((regra) => {
    setRecorrenciaEditando(regra);
    setRecorrenteDialogAberto(true);
  }, []);

  const modoRecorrentes = secaoHistorico === 'programadas';

  const aoClicarReceita = () => (modoRecorrentes ? abrirNovaRecorrencia('receita') : abrirTransacao('receita'));
  const aoClicarDespesa = () => (modoRecorrentes ? abrirNovaRecorrencia('despesa') : abrirTransacao('despesa'));

  if (carregando) return <HomeSkeleton />;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <FinancialHero
        sentinelRef={sentinelRef}
        recolhido={recolhido}
        modoRecorrentes={modoRecorrentes}
        saldo={saldoFinanceiro}
        receitas={entradas}
        despesas={saidas}
        variacaoMes={resultadoMes}
        dadosIndisponiveis={erroCarregamento}
        metaDestaque={metaDestaque}
        onAbrirMetaDestaque={onAbrirMetas}
        onReceita={aoClicarReceita}
        onDespesa={aoClicarDespesa}
        onGuardar={onAbrirMetas}
        onCartoes={onAbrirCartoes}
      />

      <section className="space-y-2">
        <SegmentGroup.Root
          value={secaoHistorico}
          onValueChange={(details) => setSecaoHistorico(details.value)}
          className="p-1 rounded-full bg-surface-hover"
        >
          <SegmentGroup.Indicator className="rounded-full bg-surface-raised dark:bg-surface-active shadow-sm" />
          {[
            { valor: 'transacoes', texto: 'Últimas transações' },
            { valor: 'programadas', texto: 'Programadas' },
          ].map((item) => (
            <SegmentGroup.Item key={item.valor} value={item.valor}>
              <SegmentGroup.ItemText
                className={`focus-ring cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  secaoHistorico === item.valor ? 'text-foreground' : 'text-foreground-muted'
                }`}
              >
                {item.texto}
              </SegmentGroup.ItemText>
              <SegmentGroup.ItemHiddenInput />
            </SegmentGroup.Item>
          ))}
        </SegmentGroup.Root>

        {modoRecorrentes ? (
          <Programadas
            programadas={programadas}
            recorrencias={recorrencias}
            acoes={acoesProgramadas}
            erroCarregamento={erroCarregamento}
            podeExcluirSerie={podeExcluirSerieRecorrente}
            onEditarSerie={abrirEditarRecorrencia}
            onEncerrarSerie={encerrarSerieRecorrente}
            onExcluirSerie={excluirSerieRecorrente}
          />
        ) : recentes.length === 0 ? (
          erroCarregamento ? (
            <EmptyState icone={SignalSlashIcon} titulo="Sem conexão" descricao="Não foi possível carregar as transações." />
          ) : (
            <EmptyState
              icone={InboxIcon}
              titulo="Nenhuma transação ainda"
              descricao="Toque em Receita ou Despesa para registrar a primeira."
            />
          )
        ) : (
          <div className="rounded-2xl border border-border bg-surface-raised p-2 divide-y divide-border">
            {recentes.map((t) => (
              <TransactionRow
                key={t.id}
                descricao={t.descricao}
                categoria={t.categoria}
                dataFormatada={formatarDataRelativa(t.data)}
                valor={t.valor}
                tipo={t.tipo}
              />
            ))}
          </div>
        )}
      </section>

      <FloatingActionButton visivel={recolhido} onClick={() => abrirTransacao()} />

      <ResponsiveDialog aberto={fluxoAberto} aoFechar={fecharFluxo}>
        <TransactionFlow
          tipoInicial={tipoFluxo}
          onFechar={fecharFluxo}
          onTransacaoSalva={handleTransacaoSalva}
          cartoes={cartoes}
          onCartaoSalvo={handleCartaoSalvo}
          onCompraCartaoSalva={handleCompraCriada}
        />
      </ResponsiveDialog>

      <ResponsiveDialog aberto={recorrenteDialogAberto} aoFechar={fecharRecorrenteDialog}>
        {recorrenteDialogAberto && (
          <RecurrenceFlow
            tipoInicial={tipoNovaRecorrencia}
            recorrenciaParaEditar={recorrenciaEditando}
            onFechar={fecharRecorrenteDialog}
            aoCriar={criarSerieRecorrente}
            aoEditar={editarSerieRecorrente}
            aoEncerrar={encerrarSerieRecorrente}
            aoExcluir={recorrenciaEditando && podeExcluirSerieRecorrente(recorrenciaEditando) ? excluirSerieRecorrente : undefined}
          />
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default Home;
