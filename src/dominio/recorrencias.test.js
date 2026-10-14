// Testes de Recorrentes como obrigação programada — `npm run test:dominio`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  idOcorrencia,
  idLiquidacao,
  normalizarSerie,
  primeiraCompetenciaPadrao,
  competenciasEsperadas,
  ocorrenciasFaltantes,
  statusEfetivo,
  diasDeAtraso,
  agruparObrigacoes,
  totaisPendentes,
  rotulosPorTipo,
  planejarLiquidacao,
  planejarDesfazerLiquidacao,
  planejarCorrecaoDeLiquidacao,
  planejarAdiamento,
  planejarEdicaoDaOcorrencia,
  planejarCancelamento,
  planejarRestauracao,
  planejarEdicaoDaSerie,
  planejarEncerramento,
  planejarExclusaoDaSerie,
  inconsistenciasDeLiquidacao,
  ehLiquidacaoRecorrente,
  NATUREZA_LIQUIDACAO_RECORRENTE,
} from './recorrencias.js';
import { calcularSaldoFinanceiroCentavos, resumoDoHero, movimentacoesRealizadas } from './caixa.js';

const AGORA = new Date(2026, 9, 14, 12, 0); // 14/out/2026 12:00
const serieBase = (extra = {}) => ({ id: 's1', descricao: 'Consórcio', valor: 850, tipo: 'despesa', categoria: 'Outro', diaDoMes: 10, ativa: true, primeiraCompetencia: '2026-09', ...extra });

// "Banco" em memória que executa os planejadores como os serviços executarão na transação do Firestore.
function criarBanco({ series = [], agora = AGORA } = {}) {
  const banco = { series: [...series], ocorrencias: new Map(), transacoes: new Map(), agora };
  banco.gerar = (horizonteMeses) => {
    const faltantes = ocorrenciasFaltantes({ series: banco.series, ocorrencias: [...banco.ocorrencias.values()], agora: banco.agora, horizonteMeses });
    let criadas = 0;
    for (const o of faltantes) {
      if (!banco.ocorrencias.has(o.id)) {
        banco.ocorrencias.set(o.id, o);
        criadas++;
      }
    }
    return criadas;
  };
  banco.liquidar = (ocorrenciaId, valor, data) => {
    const ocorrencia = banco.ocorrencias.get(ocorrenciaId);
    const existente = banco.transacoes.get(idLiquidacao(ocorrenciaId)) ?? null;
    const plano = planejarLiquidacao({ ocorrencia, valor, data, transacaoExistente: existente });
    if (!plano.ok) return plano;
    if (plano.transacao) banco.transacoes.set(plano.transacaoId, { id: plano.transacaoId, ...plano.transacao });
    banco.ocorrencias.set(ocorrenciaId, { ...ocorrencia, ...plano.ocorrenciaPatch });
    return plano;
  };
  banco.desfazer = (ocorrenciaId) => {
    const ocorrencia = banco.ocorrencias.get(ocorrenciaId);
    const plano = planejarDesfazerLiquidacao({ ocorrencia, transacaoExiste: banco.transacoes.has(idLiquidacao(ocorrenciaId)) });
    if (!plano.ok || plano.nada) return plano;
    if (plano.apagarTransacaoId) banco.transacoes.delete(plano.apagarTransacaoId);
    const nova = { ...ocorrencia, ...plano.ocorrenciaPatch };
    plano.removerCampos.forEach((c) => delete nova[c]);
    banco.ocorrencias.set(ocorrenciaId, nova);
    return plano;
  };
  banco.aplicar = (id, patch) => banco.ocorrencias.set(id, { ...banco.ocorrencias.get(id), ...patch });
  banco.caixa = () => [...banco.transacoes.values()];
  banco.saldo = (quando = banco.agora) => calcularSaldoFinanceiroCentavos(banco.caixa(), quando);
  banco.lista = () => [...banco.ocorrencias.values()].sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
  return banco;
}

describe('geração idempotente', () => {
  test('12. reabrir o app (várias vezes) não duplica ocorrências', () => {
    const banco = criarBanco({ series: [serieBase()] });
    const primeira = banco.gerar();
    assert.equal(primeira, 4); // set, out, nov, dez (mês atual + 2)
    for (let i = 0; i < 10; i++) assert.equal(banco.gerar(), 0);
    assert.equal(banco.ocorrencias.size, 4);
  });

  test('ids determinísticos serieId_competência', () => {
    assert.equal(idOcorrencia('abc', '2026-10'), 'abc_2026-10');
    assert.equal(idLiquidacao('abc_2026-10'), 'liq_abc_2026-10');
  });

  test('13. meses sem abrir são recuperados (e as vencidas aparecem atrasadas)', () => {
    const serie = serieBase({ primeiraCompetencia: '2026-05' }); // 5 meses sem abrir
    const banco = criarBanco({ series: [serie] });
    banco.gerar();
    assert.deepEqual(banco.lista().map((o) => o.competencia), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
    const efetivos = banco.lista().map((o) => statusEfetivo(o, AGORA));
    assert.deepEqual(efetivos, ['atrasada', 'atrasada', 'atrasada', 'atrasada', 'atrasada', 'atrasada', 'proxima', 'proxima']);
    // 10/out < 14/out ⇒ outubro também já passou
  });

  test('relógio voltando/avançando não duplica (mesma chave)', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.agora = new Date(2026, 8, 1, 8, 0); // voltou
    assert.equal(banco.gerar(), 0);
    banco.agora = new Date(2026, 10, 20, 8, 0); // avançou 1 mês: só cria o que faltava no horizonte novo
    assert.equal(banco.gerar(), 1);
    assert.equal(banco.ocorrencias.size, 5);
  });

  test('dia 29/30/31 é ajustado ao último dia do mês (nunca pula o mês)', () => {
    const serie = serieBase({ diaDoMes: 31, primeiraCompetencia: '2026-01' });
    const venc = ocorrenciasFaltantes({ series: [serie], ocorrencias: [], agora: new Date(2026, 1, 10), horizonteMeses: 2 }).map((o) => o.vencimento);
    assert.deepEqual(venc, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    const bissexto = ocorrenciasFaltantes({ series: [serieBase({ diaDoMes: 30, primeiraCompetencia: '2028-02' })], ocorrencias: [], agora: new Date(2028, 1, 1), horizonteMeses: 0 });
    assert.equal(bissexto[0].vencimento, '2028-02-29');
  });

  test('primeira ocorrência = primeiro vencimento ≥ hoje (sem retroativo imediato)', () => {
    assert.equal(primeiraCompetenciaPadrao(5, AGORA), '2026-11'); // dia 5 já passou em 14/10
    assert.equal(primeiraCompetenciaPadrao(20, AGORA), '2026-10');
    assert.equal(primeiraCompetenciaPadrao(14, AGORA), '2026-10'); // vence hoje conta
    assert.equal(primeiraCompetenciaPadrao(31, new Date(2026, 1, 28, 9)), '2026-02'); // 31 em fev = dia 28 = hoje
  });

  test('primeiraCompetencia é dado explícito: série em andamento (anterior) é permitida', () => {
    const esperadas = competenciasEsperadas(serieBase({ primeiraCompetencia: '2026-01' }), '2026-03');
    assert.deepEqual(esperadas, ['2026-01', '2026-02', '2026-03']);
  });

  test('cancelada conta como existente: nunca é recriada', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.aplicar('s1_2026-10', planejarCancelamento({ ocorrencia: banco.ocorrencias.get('s1_2026-10') }).patch);
    assert.equal(banco.gerar(), 0);
    assert.equal(banco.ocorrencias.get('s1_2026-10').status, 'cancelada');
  });

  test('série encerrada não gera mais; inativa não gera', () => {
    assert.deepEqual(competenciasEsperadas(serieBase({ encerradaEm: '2026-11' }), '2027-06'), ['2026-09', '2026-10']);
    assert.deepEqual(competenciasEsperadas(serieBase({ ativa: false }), '2027-06'), []);
  });

  test('totalOcorrencias conta COMPETÊNCIAS desde a primeira (cancelar não estende o plano)', () => {
    const serie = serieBase({ primeiraCompetencia: '2026-09', totalOcorrencias: 3 });
    assert.deepEqual(competenciasEsperadas(serie, '2030-01'), ['2026-09', '2026-10', '2026-11']);
    const banco = criarBanco({ series: [serie] });
    banco.gerar(24);
    banco.aplicar('s1_2026-10', { status: 'cancelada' });
    assert.equal(banco.gerar(24), 0);
    assert.equal(banco.ocorrencias.size, 3); // continua 3 competências, não 4
  });

  test('série legada (modelo antigo) é lida como série nova, sem duplicar o mês já gerado', () => {
    const legada = { id: 'leg', descricao: 'Aluguel', valor: 1000, tipo: 'despesa', categoria: 'Moradia', diaDoMes: 5, frequencia: 'mensal', ativa: true, dataInicio: { seconds: Date.UTC(2026, 5, 20) / 1000 }, ultimoRegistro: new Date(2026, 9, 5) };
    const n = normalizarSerie(legada);
    assert.equal(n.primeiraCompetencia, '2026-11'); // out já foi gerado como transação
    assert.equal(n.totalOcorrencias, null);
    assert.equal(n.encerradaEm, null);
    const semUltimo = normalizarSerie({ ...legada, ultimoRegistro: null });
    assert.equal(semUltimo.primeiraCompetencia, '2026-06');
  });
});

describe('estados derivados pelo tempo', () => {
  const oc = (vencimento, status = 'pendente') => ({ id: 'x', status, vencimento });

  test('14. atraso derivado: vence hoje NÃO está atrasada durante o próprio dia', () => {
    assert.equal(statusEfetivo(oc('2026-10-14'), new Date(2026, 9, 14, 0, 1)), 'venceHoje');
    assert.equal(statusEfetivo(oc('2026-10-14'), new Date(2026, 9, 14, 23, 59)), 'venceHoje');
    assert.equal(statusEfetivo(oc('2026-10-14'), new Date(2026, 9, 15, 0, 0)), 'atrasada');
    assert.equal(statusEfetivo(oc('2026-10-15'), new Date(2026, 9, 14, 23, 59)), 'proxima');
    assert.equal(diasDeAtraso(oc('2026-10-10'), AGORA), 4);
    assert.equal(diasDeAtraso(oc('2026-10-14'), AGORA), 0);
  });

  test('realizada e cancelada não são atrasadas, mesmo vencidas', () => {
    assert.equal(statusEfetivo(oc('2020-01-01', 'realizada'), AGORA), 'realizada');
    assert.equal(statusEfetivo(oc('2020-01-01', 'cancelada'), AGORA), 'cancelada');
  });

  test('agrupar: atrasadas, vence hoje, próximas, realizadas recentes, canceladas', () => {
    const lista = [
      { id: 'a', status: 'pendente', vencimento: '2026-10-01', competencia: '2026-10' },
      { id: 'b', status: 'pendente', vencimento: '2026-10-14', competencia: '2026-10' },
      { id: 'c', status: 'pendente', vencimento: '2026-11-10', competencia: '2026-11' },
      { id: 'd', status: 'realizada', vencimento: '2026-09-10', competencia: '2026-09', transacaoId: 'liq_d' },
      { id: 'e', status: 'realizada', vencimento: '2026-01-10', competencia: '2026-01', transacaoId: 'liq_e' },
      { id: 'f', status: 'cancelada', vencimento: '2026-09-10', competencia: '2026-09' },
    ];
    const liquidacoes = { liq_d: { data: '2026-10-05T10:00' }, liq_e: { data: '2026-01-12T10:00' } };
    const g = agruparObrigacoes(lista, AGORA, { liquidacoesPorId: liquidacoes });
    assert.deepEqual(g.atrasadas.map((o) => o.id), ['a']);
    assert.deepEqual(g.venceHoje.map((o) => o.id), ['b']);
    assert.deepEqual(g.proximas.map((o) => o.id), ['c']);
    assert.deepEqual(g.realizadasRecentes.map((o) => o.id), ['d']); // 'e' é antiga demais
    assert.deepEqual(g.canceladas.map((o) => o.id), ['f']);
  });

  test('totais A pagar / A receber somam só pendentes e nunca viram saldo', () => {
    const lista = [
      { tipo: 'despesa', valor: 850.1, status: 'pendente' },
      { tipo: 'despesa', valor: 0.2, status: 'pendente' },
      { tipo: 'receita', valor: 5000, status: 'pendente' },
      { tipo: 'despesa', valor: 999, status: 'realizada' },
      { tipo: 'receita', valor: 999, status: 'cancelada' },
    ];
    assert.deepEqual(totaisPendentes(lista), { aPagarCentavos: 85030, aReceberCentavos: 500000 });
  });

  test('a UI traduz a direção (receita × despesa) sem mudar o domínio', () => {
    assert.equal(rotulosPorTipo('despesa').acao, 'Pagar');
    assert.equal(rotulosPorTipo('despesa').estado, 'Paga');
    assert.equal(rotulosPorTipo('receita').acao, 'Receber');
    assert.equal(rotulosPorTipo('receita').desfazer, 'Desfazer recebimento');
  });
});

describe('obrigação ≠ pagamento (saldo)', () => {
  test('1. e 2. pendente e atrasada NÃO mudam o saldo; só a liquidação muda', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    assert.ok(banco.lista().some((o) => statusEfetivo(o, AGORA) === 'atrasada'));
    assert.equal(banco.saldo(), 0);
    assert.equal(resumoDoHero(banco.caixa(), AGORA).saidasCentavos, 0);
  });

  test('3., 4. e 5. liquidar cria exatamente uma transação; 2ª vez não duplica; saldo muda uma vez', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    const r1 = banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    assert.equal(r1.ok, true);
    assert.equal(banco.transacoes.size, 1);
    assert.equal(banco.saldo(), -85000);
    const r2 = banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    assert.deepEqual([r2.ok, r2.motivo], [false, 'ja_realizada']);
    assert.equal(banco.transacoes.size, 1);
    assert.equal(banco.saldo(), -85000);
    assert.equal(banco.ocorrencias.get('s1_2026-10').transacaoId, 'liq_s1_2026-10');
  });

  test('vínculo explícito: a transação sabe série, ocorrência e competência', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    const t = banco.transacoes.get('liq_s1_2026-10');
    assert.equal(t.natureza, NATUREZA_LIQUIDACAO_RECORRENTE);
    assert.equal(ehLiquidacaoRecorrente(t), true);
    assert.deepEqual([t.serieId, t.ocorrenciaId, t.competencia, t.tipo], ['s1', 's1_2026-10', '2026-10', 'despesa']);
  });

  test('pagamento em data diferente do vencimento: obrigação 10/10, saída em 13/10', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    assert.equal(banco.ocorrencias.get('s1_2026-10').vencimento, '2026-10-10');
    assert.equal(banco.saldo(new Date(2026, 9, 12, 23, 59)), 0); // antes do pagamento
    assert.equal(banco.saldo(new Date(2026, 9, 13, 9, 0)), -85000); // a partir do pagamento
  });

  test('15. liquidação com data futura não entra no caixa até a data', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.liquidar('s1_2026-11', 850, '2026-11-10T09:00');
    assert.equal(banco.ocorrencias.get('s1_2026-11').status, 'realizada');
    assert.equal(banco.saldo(), 0);
    assert.equal(banco.saldo(new Date(2026, 10, 10, 9, 0)), -85000);
  });

  test('16. datas inválidas são recusadas pelo domínio temporal', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    assert.equal(banco.liquidar('s1_2026-10', 850, 'lixo').motivo, 'data_invalida');
    assert.equal(banco.liquidar('s1_2026-10', 850, '2026-02-31T10:00').motivo, 'data_invalida');
    assert.equal(banco.liquidar('s1_2026-10', 0, '2026-10-13T09:00').motivo, 'valor_invalido');
    assert.equal(banco.transacoes.size, 0);
  });

  test('17. e 18. a liquidação aparece no livro-caixa; a pendente nunca é transação realizada', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    assert.equal(movimentacoesRealizadas(banco.caixa(), AGORA).length, 0);
    banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    const realizadas = movimentacoesRealizadas(banco.caixa(), AGORA);
    assert.equal(realizadas.length, 1);
    assert.equal(realizadas[0].valor, 850);
  });

  test('receita recorrente: previsto não aumenta o saldo; recebido aumenta', () => {
    const banco = criarBanco({ series: [serieBase({ id: 'sal', descricao: 'Salário', tipo: 'receita', valor: 5000, diaDoMes: 5, primeiraCompetencia: '2026-10' })] });
    banco.gerar();
    assert.equal(banco.saldo(), 0);
    banco.liquidar('sal_2026-10', 5000, '2026-10-05T08:00');
    assert.equal(banco.saldo(), 500000);
    assert.equal(banco.transacoes.get('liq_sal_2026-10').tipo, 'receita');
  });

  test('cancelada não liquida', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.aplicar('s1_2026-10', { status: 'cancelada' });
    assert.equal(banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00').motivo, 'cancelada');
  });
});

describe('desfazer liquidação', () => {
  test('6. remove a transação e volta a pendente (atrasada se já venceu); sem órfã', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    const r = banco.desfazer('s1_2026-10');
    assert.equal(r.ok, true);
    assert.equal(r.reconciliada, false);
    assert.equal(banco.transacoes.size, 0);
    assert.equal(banco.saldo(), 0);
    const o = banco.ocorrencias.get('s1_2026-10');
    assert.equal(o.status, 'pendente');
    assert.equal('transacaoId' in o, false);
    assert.equal(statusEfetivo(o, AGORA), 'atrasada');
    assert.equal(inconsistenciasDeLiquidacao({ ocorrencias: banco.lista(), transacoes: banco.caixa() }).temProblemas, false);
  });

  test('desfazer duas vezes é seguro (a segunda não faz nada)', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    banco.desfazer('s1_2026-10');
    assert.equal(banco.desfazer('s1_2026-10').nada, true);
  });

  test('pode ser liquidada de novo depois de desfeita, com uma única transação', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    banco.desfazer('s1_2026-10');
    banco.liquidar('s1_2026-10', 860, '2026-10-14T09:00');
    assert.equal(banco.transacoes.size, 1);
    assert.equal(banco.saldo(), -86000);
  });

  test('reconcilia: realizada cuja transação foi removida por fora volta a pendente e avisa', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    banco.transacoes.delete('liq_s1_2026-10'); // dado inconsistente
    const inc = inconsistenciasDeLiquidacao({ ocorrencias: banco.lista(), transacoes: banco.caixa() });
    assert.deepEqual(inc.realizadaSemTransacao.map((o) => o.id), ['s1_2026-10']);
    const r = banco.desfazer('s1_2026-10');
    assert.deepEqual([r.ok, r.reconciliada, r.apagarTransacaoId], [true, true, null]);
    assert.equal(banco.ocorrencias.get('s1_2026-10').status, 'pendente');
  });

  test('reconcilia: transação existente com ocorrência pendente é apagada, sem duplicar', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.transacoes.set('liq_s1_2026-10', { id: 'liq_s1_2026-10', tipo: 'despesa', valor: 850, data: '2026-10-13T09:00', natureza: NATUREZA_LIQUIDACAO_RECORRENTE, ocorrenciaId: 's1_2026-10' });
    const inc = inconsistenciasDeLiquidacao({ ocorrencias: banco.lista(), transacoes: banco.caixa() });
    assert.equal(inc.transacaoSemOcorrencia.length, 1);
    const r = banco.desfazer('s1_2026-10');
    assert.deepEqual([r.ok, r.reconciliada], [true, true]);
    assert.equal(banco.transacoes.size, 0);
  });

  test('liquidar quando já existe a transação (dado inconsistente) vincula em vez de duplicar', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.transacoes.set('liq_s1_2026-10', { id: 'liq_s1_2026-10', tipo: 'despesa', valor: 850, data: '2026-10-13T09:00', natureza: NATUREZA_LIQUIDACAO_RECORRENTE, ocorrenciaId: 's1_2026-10' });
    const r = banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    assert.deepEqual([r.ok, r.reconciliada], [true, true]);
    assert.equal(banco.transacoes.size, 1);
    assert.equal(banco.ocorrencias.get('s1_2026-10').status, 'realizada');
  });

  test('corrigir valor/data da liquidação não mexe na obrigação', () => {
    const banco = criarBanco({ series: [serieBase()] });
    banco.gerar();
    banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    const plano = planejarCorrecaoDeLiquidacao({ ocorrencia: banco.ocorrencias.get('s1_2026-10'), transacaoExiste: true, valor: 840, data: '2026-10-12T10:00' });
    assert.equal(plano.ok, true);
    assert.deepEqual(plano.transacaoPatch, { valor: 840, data: '2026-10-12T10:00' });
    assert.equal(banco.ocorrencias.get('s1_2026-10').valor, 850);
    assert.equal(planejarCorrecaoDeLiquidacao({ ocorrencia: banco.ocorrencias.get('s1_2026-11'), transacaoExiste: false, valor: 1, data: '2026-10-12T10:00' }).ok, false);
  });
});

describe('ações sobre uma ocorrência', () => {
  const comOcorrencias = () => {
    const banco = criarBanco({ series: [serieBase({ primeiraCompetencia: '2026-10' })] });
    banco.gerar();
    return banco;
  };

  test('7. adiar muda só esta ocorrência e preserva o vencimento original; a série segue o calendário', () => {
    const banco = comOcorrencias();
    const plano = planejarAdiamento({ ocorrencia: banco.ocorrencias.get('s1_2026-10'), novoVencimento: '2026-10-18' });
    assert.equal(plano.ok, true);
    banco.aplicar('s1_2026-10', plano.patch);
    const o = banco.ocorrencias.get('s1_2026-10');
    assert.deepEqual([o.vencimento, o.vencimentoOriginal, o.status], ['2026-10-18', '2026-10-10', 'pendente']);
    assert.deepEqual(o.sobrescritos, ['vencimento']);
    assert.equal(banco.ocorrencias.get('s1_2026-11').vencimento, '2026-11-10');
    assert.equal(banco.ocorrencias.get('s1_2026-12').vencimento, '2026-12-10');
    assert.equal(statusEfetivo(o, AGORA), 'proxima'); // adiada deixa de estar atrasada
  });

  test('adiar de volta ao calendário da série deixa de ser exceção', () => {
    const banco = comOcorrencias();
    banco.aplicar('s1_2026-10', planejarAdiamento({ ocorrencia: banco.ocorrencias.get('s1_2026-10'), novoVencimento: '2026-10-18' }).patch);
    banco.aplicar('s1_2026-10', planejarAdiamento({ ocorrencia: banco.ocorrencias.get('s1_2026-10'), novoVencimento: '2026-10-10' }).patch);
    assert.deepEqual(banco.ocorrencias.get('s1_2026-10').sobrescritos, []);
  });

  test('adiar/editar/cancelar realizada é bloqueado: desfazer antes', () => {
    const banco = comOcorrencias();
    banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    const o = banco.ocorrencias.get('s1_2026-10');
    for (const plano of [planejarAdiamento({ ocorrencia: o, novoVencimento: '2026-10-20' }), planejarEdicaoDaOcorrencia({ ocorrencia: o, campos: { valor: 1 } }), planejarCancelamento({ ocorrencia: o })]) {
      assert.deepEqual([plano.ok, plano.motivo], [false, 'realizada_desfazer_antes']);
    }
  });

  test('8. cancelar uma ocorrência não cancela a série; a próxima continua', () => {
    const banco = comOcorrencias();
    banco.aplicar('s1_2026-10', planejarCancelamento({ ocorrencia: banco.ocorrencias.get('s1_2026-10') }).patch);
    assert.equal(banco.ocorrencias.get('s1_2026-10').status, 'cancelada');
    assert.equal(banco.ocorrencias.get('s1_2026-11').status, 'pendente');
    assert.equal(banco.series[0].ativa, true);
    assert.equal(banco.gerar(), 0);
    assert.equal(banco.saldo(), 0);
  });

  test('restaurar uma cancelada volta a pendente', () => {
    const banco = comOcorrencias();
    banco.aplicar('s1_2026-10', { status: 'cancelada' });
    banco.aplicar('s1_2026-10', planejarRestauracao({ ocorrencia: banco.ocorrencias.get('s1_2026-10') }).patch);
    assert.equal(banco.ocorrencias.get('s1_2026-10').status, 'pendente');
    assert.equal(planejarRestauracao({ ocorrencia: banco.ocorrencias.get('s1_2026-11') }).motivo, 'nao_cancelada');
  });

  test('11. editar a ocorrência (valor excepcional) não altera a série nem as outras', () => {
    const banco = comOcorrencias();
    const plano = planejarEdicaoDaOcorrencia({ ocorrencia: banco.ocorrencias.get('s1_2026-10'), campos: { valor: 540.5 } });
    assert.equal(plano.ok, true);
    banco.aplicar('s1_2026-10', plano.patch);
    assert.equal(banco.ocorrencias.get('s1_2026-10').valor, 540.5);
    assert.deepEqual(banco.ocorrencias.get('s1_2026-10').sobrescritos, ['valor']);
    assert.equal(banco.ocorrencias.get('s1_2026-11').valor, 850);
    assert.equal(banco.series[0].valor, 850);
  });

  test('editar sem mudar nada não vira exceção; valor/descrição inválidos são recusados', () => {
    const banco = comOcorrencias();
    const o = banco.ocorrencias.get('s1_2026-10');
    assert.deepEqual(planejarEdicaoDaOcorrencia({ ocorrencia: o, campos: { valor: 850, descricao: 'Consórcio' } }).patch.sobrescritos, []);
    assert.equal(planejarEdicaoDaOcorrencia({ ocorrencia: o, campos: { valor: -1 } }).motivo, 'valor_invalido');
    assert.equal(planejarEdicaoDaOcorrencia({ ocorrencia: o, campos: { descricao: '  ' } }).motivo, 'descricao_invalida');
  });
});

describe('editar / encerrar / excluir a série', () => {
  const montar = () => {
    const banco = criarBanco({ series: [serieBase({ primeiraCompetencia: '2026-08' })] });
    banco.gerar(); // ago(atrasada) set(atrasada) out(atrasada) nov dez (pendentes futuras)
    return banco;
  };

  test('10. editar a série NÃO reescreve realizada nem atrasada; atualiza pendentes futuras', () => {
    const banco = montar();
    banco.liquidar('s1_2026-08', 800, '2026-08-10T09:00'); // paga a R$ 800
    const nova = { ...banco.series[0], valor: 850 };
    banco.series[0] = { ...banco.series[0], valor: 800 }; // série "era" 800
    for (const o of banco.lista()) banco.aplicar(o.id, { valor: 800 });
    const plano = planejarEdicaoDaSerie({ serieAntiga: banco.series[0], serieNova: nova, ocorrencias: banco.lista(), agora: AGORA });
    plano.patches.forEach((p) => banco.aplicar(p.id, p.campos));
    assert.equal(banco.ocorrencias.get('s1_2026-08').valor, 800); // realizada
    assert.equal(banco.ocorrencias.get('s1_2026-09').valor, 800); // atrasada
    assert.equal(banco.ocorrencias.get('s1_2026-10').valor, 800); // atrasada (venceu dia 10)
    assert.equal(banco.ocorrencias.get('s1_2026-11').valor, 850); // pendente futura
    assert.equal(banco.ocorrencias.get('s1_2026-12').valor, 850);
    assert.equal(plano.contagem, 2);
    assert.equal(banco.transacoes.get('liq_s1_2026-08').valor, 800); // caixa histórico intacto
  });

  test('edição da série respeita exceção por campo (sobrescritos)', () => {
    const banco = montar();
    banco.aplicar('s1_2026-11', planejarEdicaoDaOcorrencia({ ocorrencia: banco.ocorrencias.get('s1_2026-11'), campos: { valor: 900 } }).patch);
    const plano = planejarEdicaoDaSerie({ serieAntiga: banco.series[0], serieNova: { ...banco.series[0], valor: 1000, descricao: 'Consórcio Novo' }, ocorrencias: banco.lista(), agora: AGORA });
    plano.patches.forEach((p) => banco.aplicar(p.id, p.campos));
    const nov = banco.ocorrencias.get('s1_2026-11');
    assert.equal(nov.valor, 900); // valor sobrescrito: não recebe
    assert.equal(nov.descricao, 'Consórcio Novo'); // descrição não sobrescrita: recebe
    assert.equal(banco.ocorrencias.get('s1_2026-12').valor, 1000);
  });

  test('mudar o DIA da série atualiza vencimentoOriginal e vencimento (não é adiamento) das sem exceção', () => {
    const banco = montar();
    banco.aplicar('s1_2026-12', planejarAdiamento({ ocorrencia: banco.ocorrencias.get('s1_2026-12'), novoVencimento: '2026-12-22' }).patch);
    const plano = planejarEdicaoDaSerie({ serieAntiga: banco.series[0], serieNova: { ...banco.series[0], diaDoMes: 20 }, ocorrencias: banco.lista(), agora: AGORA });
    plano.patches.forEach((p) => banco.aplicar(p.id, p.campos));
    const nov = banco.ocorrencias.get('s1_2026-11');
    assert.deepEqual([nov.vencimentoOriginal, nov.vencimento, nov.sobrescritos], ['2026-11-20', '2026-11-20', []]);
    const dez = banco.ocorrencias.get('s1_2026-12'); // tem exceção de vencimento: não recebe
    assert.deepEqual([dez.vencimentoOriginal, dez.vencimento], ['2026-12-10', '2026-12-22']);
  });

  test('mudar o dia não fabrica atrasada: nova data no passado mantém a atual', () => {
    const banco = criarBanco({ series: [serieBase({ primeiraCompetencia: '2026-10', diaDoMes: 25 })] });
    banco.gerar();
    const plano = planejarEdicaoDaSerie({ serieAntiga: banco.series[0], serieNova: { ...banco.series[0], diaDoMes: 2 }, ocorrencias: banco.lista(), agora: AGORA });
    plano.patches.forEach((p) => banco.aplicar(p.id, p.campos));
    assert.equal(banco.ocorrencias.get('s1_2026-10').vencimento, '2026-10-25'); // 02/10 já passou: mantém
    assert.equal(banco.ocorrencias.get('s1_2026-11').vencimento, '2026-11-02'); // futura: atualiza
  });

  test('9. encerrar preserva histórico (realizadas e atrasadas) e cancela só as futuras pendentes', () => {
    const banco = montar();
    banco.liquidar('s1_2026-08', 850, '2026-08-10T09:00');
    const plano = planejarEncerramento({ serie: banco.series[0], ocorrencias: banco.lista(), agora: AGORA });
    assert.deepEqual(plano.cancelarIds.sort(), ['s1_2026-11', 's1_2026-12']);
    assert.deepEqual(plano.preservadas, { atrasadas: 2, realizadas: 1 });
    assert.equal(plano.serieCampos.ativa, false);
    assert.equal(plano.serieCampos.encerradaEm, '2026-11');
    plano.cancelarIds.forEach((id) => banco.aplicar(id, { status: 'cancelada' }));
    banco.series[0] = { ...banco.series[0], ...plano.serieCampos };
    assert.equal(banco.ocorrencias.get('s1_2026-08').status, 'realizada');
    assert.equal(banco.transacoes.size, 1); // pagamento histórico permanece
    assert.equal(statusEfetivo(banco.ocorrencias.get('s1_2026-09'), AGORA), 'atrasada');
    banco.agora = new Date(2027, 2, 1);
    assert.equal(banco.gerar(), 0); // nunca mais gera
  });

  test('excluir a série: só se nunca houve liquidação; senão, encerrar', () => {
    const banco = montar();
    const livre = planejarExclusaoDaSerie({ serie: banco.series[0], ocorrencias: banco.lista() });
    assert.equal(livre.ok, true);
    assert.equal(livre.apagarOcorrenciaIds.length, 5);
    banco.liquidar('s1_2026-08', 850, '2026-08-10T09:00');
    const bloqueada = planejarExclusaoDaSerie({ serie: banco.series[0], ocorrencias: banco.lista() });
    assert.deepEqual([bloqueada.ok, bloqueada.motivo], [false, 'tem_realizadas']);
  });
});

describe('séries independentes', () => {
  test('marcar outubro como pago não faz novembro parecer pago', () => {
    const banco = criarBanco({ series: [serieBase({ primeiraCompetencia: '2026-10' }), serieBase({ id: 's2', descricao: 'Internet', valor: 120, diaDoMes: 20, primeiraCompetencia: '2026-10' })] });
    banco.gerar();
    banco.liquidar('s1_2026-10', 850, '2026-10-13T09:00');
    assert.equal(banco.ocorrencias.get('s1_2026-11').status, 'pendente');
    assert.equal(banco.ocorrencias.get('s2_2026-10').status, 'pendente');
    assert.equal(banco.saldo(), -85000);
  });
});
