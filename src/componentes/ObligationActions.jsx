import React, { useState } from 'react';
import Input from './ui/Input';
import Button from './ui/Button';
import Badge from './ui/Badge';
import DateTimeField from './ui/DateTimeField';
import ComboboxField from './ui/ComboboxField';
import { CATEGORIAS_TRANSACAO } from '../constantes/categorias.js';
import { obterDataHoraLocal, formatarDiaMes } from '../utils/datas.js';
import { descreverObrigacao } from '../utils/obrigacoes.js';
import { rotulosPorTipo } from '../dominio/recorrencias.js';
import { paraInputLocal, paraDataISO, jaOcorreu } from '../dominio/tempo.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const OPCOES_CATEGORIA = CATEGORIAS_TRANSACAO.map((c) => ({ valor: c, texto: c }));
const centavosDe = (reais) => String(Math.round(Number(reais) * 100));

function Cabecalho({ titulo, onVoltar, textoVoltar = 'Voltar' }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <button type="button" onClick={onVoltar} className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 rounded-lg">
        {textoVoltar}
      </button>
      <p className="text-sm font-semibold text-foreground">{titulo}</p>
      <div className="w-16" aria-hidden="true" />
    </div>
  );
}

function CampoValor({ id, label, valorCentavos, onChange }) {
  return (
    <Input
      id={id}
      label={label}
      inputMode="numeric"
      value={formatadorMoeda.format(Number(valorCentavos || '0') / 100)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '') || '0')}
    />
  );
}

// Tudo que se pode fazer com UMA conta programada, numa só sheet (linha da lista fica enxuta):
//   pendente  → Pagar/Receber · Adiar · Editar esta · Cancelar esta conta
//   quitada   → Corrigir valor/data · Desfazer pagamento/recebimento
//   cancelada → Restaurar
// `modoInicial='corrigir'` é a porta de entrada vinda de Movimentações (editar a transação de
// liquidação nunca é uma edição genérica). Todas as ações são atômicas no serviço.
const ObligationActions = ({ ocorrencia, agora, liquidacao, acoes, modoInicial = 'menu', onFechar }) => {
  const [modo, setModo] = useState(modoInicial);
  const [ocupado, setOcupado] = useState(false);

  const rotulos = rotulosPorTipo(ocorrencia.tipo);
  const { texto, badge } = descreverObrigacao(ocorrencia, agora, liquidacao);
  const pendente = ocorrencia.status === 'pendente';
  const quitada = ocorrencia.status === 'realizada';
  const cancelada = ocorrencia.status === 'cancelada';

  const [valorCentavos, setValorCentavos] = useState(() => centavosDe(quitada && liquidacao ? liquidacao.valor : ocorrencia.valor));
  const [data, setData] = useState(() => (quitada && liquidacao ? paraInputLocal(liquidacao.data) : obterDataHoraLocal()));
  const [novoVencimento, setNovoVencimento] = useState(() => `${ocorrencia.vencimento}T00:00`);
  const [descricao, setDescricao] = useState(ocorrencia.descricao);
  const [categoria, setCategoria] = useState(ocorrencia.categoria);

  const voltarAoMenu = () => setModo('menu');

  // Roda a ação; sucesso fecha a sheet, falha mantém o formulário aberto (o toast já explicou).
  const executar = async (acao) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const ok = await acao();
      if (ok) onFechar();
      else setOcupado(false);
    } catch (erro) {
      console.error('Erro na ação da conta programada:', erro);
      setOcupado(false);
    }
  };

  const valorReais = Number(valorCentavos || '0') / 100;

  if (modo === 'liquidar' || modo === 'corrigir') {
    const corrigindo = modo === 'corrigir';
    const futura = !jaOcorreu(data, new Date());
    return (
      <div className="space-y-4">
        <Cabecalho titulo={corrigindo ? `Corrigir ${rotulos.verbo}` : rotulos.acao === 'Pagar' ? 'Registrar pagamento' : 'Registrar recebimento'} onVoltar={corrigindo && modoInicial === 'corrigir' ? onFechar : voltarAoMenu} textoVoltar={corrigindo && modoInicial === 'corrigir' ? 'Fechar' : 'Voltar'} />
        <div className="rounded-xl bg-surface p-3 text-sm space-y-0.5">
          <p className="font-medium text-foreground">{ocorrencia.descricao}</p>
          <p className="text-foreground-muted text-xs">Vencimento {formatarDiaMes(ocorrencia.vencimento)} · previsto {formatadorMoeda.format(ocorrencia.valor)}</p>
        </div>
        <CampoValor id="valor-liquidacao" label={rotulos.acao === 'Pagar' ? 'Valor pago' : 'Valor recebido'} valorCentavos={valorCentavos} onChange={setValorCentavos} />
        <DateTimeField id="data-liquidacao" label={rotulos.acao === 'Pagar' ? 'Data do pagamento' : 'Data do recebimento'} value={data} onChange={setData} />
        {futura && <p className="text-xs text-foreground-muted">Data futura: o valor só entra no saldo a partir dela.</p>}
        <Button
          size="lg"
          className="w-full"
          disabled={!(valorReais > 0) || ocupado}
          carregando={ocupado}
          onClick={() =>
            executar(() => (corrigindo ? acoes.corrigir(ocorrencia, { valor: valorReais, data }) : acoes.liquidar(ocorrencia, { valor: valorReais, data })))
          }
        >
          {corrigindo ? 'Salvar alterações' : rotulos.acao === 'Pagar' ? 'Confirmar pagamento' : 'Confirmar recebimento'}
        </Button>
      </div>
    );
  }

  if (modo === 'adiar') {
    const mudou = paraDataISO(novoVencimento) !== ocorrencia.vencimento;
    return (
      <div className="space-y-4">
        <Cabecalho titulo="Adiar esta conta" onVoltar={voltarAoMenu} />
        <p className="text-sm text-foreground-secondary">
          Só esta conta muda de data. A recorrência e as próximas contas continuam no dia de sempre. Vencimento original: {formatarDiaMes(ocorrencia.vencimentoOriginal)}.
        </p>
        <DateTimeField id="novo-vencimento" label="Novo vencimento" value={novoVencimento} onChange={setNovoVencimento} somenteData />
        <Button size="lg" className="w-full" disabled={!mudou || ocupado} carregando={ocupado} onClick={() => executar(() => acoes.adiar(ocorrencia, paraDataISO(novoVencimento)))}>
          Adiar
        </Button>
      </div>
    );
  }

  if (modo === 'editar') {
    const podeSalvar = valorReais > 0 && descricao.trim() !== '' && categoria !== '' && !ocupado;
    return (
      <div className="space-y-4">
        <Cabecalho titulo="Editar só esta conta" onVoltar={voltarAoMenu} />
        <p className="text-sm text-foreground-secondary">A mudança vale apenas para esta conta; a recorrência não é alterada.</p>
        <CampoValor id="valor-conta" label="Valor" valorCentavos={valorCentavos} onChange={setValorCentavos} />
        <Input label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <ComboboxField id="categoria-conta" label="Categoria" value={categoria} onChange={setCategoria} opcoes={OPCOES_CATEGORIA} placeholder="Selecione uma categoria" />
        <Button
          size="lg"
          className="w-full"
          disabled={!podeSalvar}
          carregando={ocupado}
          onClick={() => executar(() => acoes.editar(ocorrencia, { valor: valorReais, descricao, categoria }))}
        >
          Salvar
        </Button>
      </div>
    );
  }

  // menu
  return (
    <div className="space-y-4">
      <Cabecalho titulo={rotulos.grupo} onVoltar={onFechar} textoVoltar="Fechar" />

      <div className="rounded-xl bg-surface p-4 space-y-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-foreground">{ocorrencia.descricao}</p>
          {badge && <Badge variant={badge.variant}>{badge.texto}</Badge>}
        </div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{formatadorMoeda.format(quitada && liquidacao ? liquidacao.valor : ocorrencia.valor)}</p>
        <p className="text-xs text-foreground-muted">{texto}</p>
        {quitada && liquidacao && liquidacao.valor !== ocorrencia.valor && (
          <p className="text-xs text-foreground-muted">Previsto: {formatadorMoeda.format(ocorrencia.valor)}</p>
        )}
      </div>

      {pendente && (
        <div className="space-y-2">
          <Button size="lg" className="w-full" onClick={() => setModo('liquidar')}>
            {rotulos.acao}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setModo('adiar')}>
              Adiar
            </Button>
            <Button variant="secondary" onClick={() => setModo('editar')}>
              Editar esta
            </Button>
          </div>
          <Button variant="ghost" className="w-full" disabled={ocupado} onClick={() => executar(() => acoes.cancelar(ocorrencia))}>
            Cancelar esta conta
          </Button>
        </div>
      )}

      {quitada && (
        <div className="space-y-2">
          {liquidacao && (
            <Button variant="secondary" size="lg" className="w-full" onClick={() => setModo('corrigir')}>
              Corrigir valor ou data
            </Button>
          )}
          <Button variant="ghost" className="w-full" disabled={ocupado} onClick={() => executar(() => acoes.desfazer(ocorrencia))}>
            {rotulos.desfazer}
          </Button>
          {!liquidacao && <p className="text-xs text-warning">O registro do {rotulos.verbo} não foi encontrado. Use “{rotulos.desfazer}” para reconciliar.</p>}
        </div>
      )}

      {cancelada && (
        <Button size="lg" className="w-full" disabled={ocupado} carregando={ocupado} onClick={() => executar(() => acoes.restaurar(ocorrencia))}>
          Restaurar esta conta
        </Button>
      )}
    </div>
  );
};

export default ObligationActions;
