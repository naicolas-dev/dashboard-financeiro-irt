// Testes do domínio financeiro de Cartões V2 — `npm run test:dominio`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  movimentacoesDeCaixa,
  NATUREZA_PAGAMENTO_FATURA,
  gerarValoresParcelas,
  calcularPrimeiraCompetencia,
  dataFechamento,
  dataVencimento,
  statusCiclo,
  parcelasDaCompra,
  alocarPagamentos,
  faturasDoCartao,
  resumoDoCartao,
  maximoPagamentoCentavos,
  regrasDaCompra,
  validarPagamento,
  gastosNoCartaoNoMes,
} from './cartoes.js';

// Nubank fictício: fecha dia 3, vence dia 10 (mesmo mês). Limite R$ 5.000.
const NUBANK = { id: 'nu', nome: 'Nubank', limiteTotal: 5000, diaFechamento: 3, diaVencimento: 10 };
const HOJE = new Date(2026, 9, 12, 15, 0); // 12/out/2026 → fatura aberta = 2026-11

const saldo = (transacoes) =>
  movimentacoesDeCaixa(transacoes).reduce((a, t) => a + (t.tipo === 'receita' ? 1 : -1) * Math.round(t.valor * 100), 0);

const receita = (valor) => ({ id: `r${valor}`, tipo: 'receita', valor, data: '2026-10-01T09:00' });

function compra(id, valorTotal, numeroParcelas, dataCompra, cartao = NUBANK) {
  return {
    id,
    cartaoId: cartao.id,
    descricao: id,
    categoria: 'Outro',
    valorTotal,
    numeroParcelas,
    dataCompra,
    primeiraCompetencia: calcularPrimeiraCompetencia(new Date(dataCompra), cartao.diaFechamento),
  };
}

function pagamento(id, valor, competencia, data = '2026-10-12T16:00', cartao = NUBANK) {
  return { id, tipo: 'despesa', valor, data, natureza: NATUREZA_PAGAMENTO_FATURA, cartaoId: cartao.id, competencia };
}

describe('casos do pedido', () => {
  const notebook = compra('notebook', 1200, 6, '2026-10-12T15:00');

  test('Caso 1 — compra 1.200 em 6x: saldo intacto, dívida 1.200, fatura atual 200', () => {
    const caixa = [receita(5000)];
    const r = resumoDoCartao({ cartao: NUBANK, compras: [notebook], pagamentos: [], hoje: HOJE });
    assert.equal(saldo(caixa), 500000);
    assert.equal(r.dividaCentavos, 120000);
    assert.equal(r.faturaAtualCentavos, 20000);
    assert.equal(r.proximasParcelasCentavos, 100000);
    assert.equal(r.limiteDisponivelCentavos, 380000);
  });

  test('Caso 2 — pagar 200: saldo 4.800, dívida 1.000, fatura paga, limite volta', () => {
    const pg = pagamento('pg1', 200, '2026-11');
    const caixa = [receita(5000), pg];
    const r = resumoDoCartao({ cartao: NUBANK, compras: [notebook], pagamentos: [pg], hoje: HOJE });
    assert.equal(saldo(caixa), 480000);
    assert.equal(r.dividaCentavos, 100000);
    assert.equal(r.faturaAtual.statusPagamento, 'paga');
    assert.equal(r.limiteDisponivelCentavos, 400000);
  });

  test('Caso 3 — à vista no cartão 300: dívida +300, saldo inalterado', () => {
    const tv = compra('tv', 300, 1, '2026-10-12T15:00');
    const r = resumoDoCartao({ cartao: NUBANK, compras: [tv], pagamentos: [], hoje: HOJE });
    assert.equal(saldo([receita(5000)]), 500000);
    assert.equal(r.dividaCentavos, 30000);
  });

  test('Caso 4 — Pix 300: saldo −300 na hora, nenhuma dívida', () => {
    const pix = { id: 'pix', tipo: 'despesa', valor: 300, data: '2026-10-12T15:00' };
    const r = resumoDoCartao({ cartao: NUBANK, compras: [], pagamentos: [], hoje: HOJE });
    assert.equal(saldo([receita(5000), pix]), 470000);
    assert.equal(r.dividaCentavos, 0);
  });

  test('Caso 5 — fatura 1.000 com saldo 600: aviso (não bloqueio); parcial 600 deixa 400', () => {
    const v = validarPagamento({ valorCentavos: 100000, maximoCentavos: 100000, saldoFinanceiroCentavos: 60000, saldoDisponivelCentavos: 60000 });
    assert.deepEqual(v, { ok: true, aviso: 'saldo_negativo' });

    const geladeira = compra('geladeira', 1000, 1, '2026-10-12T15:00');
    const pg = pagamento('pg', 600, '2026-11');
    const r = resumoDoCartao({ cartao: NUBANK, compras: [geladeira], pagamentos: [pg], hoje: HOJE });
    assert.equal(r.faturaAtual.statusPagamento, 'parcial');
    assert.equal(r.faturaAtual.restanteCentavos, 40000);
    assert.equal(r.dividaCentavos, 40000);
  });

  test('Caso 6 — compra com faturas pagas pode ser editada/excluída, mas com aviso; pagamentos não mudam', () => {
    // Comprada em agosto: parcelas 2026-08 (já fechada) em diante, duas pagas.
    const antiga = compra('antiga', 1200, 6, '2026-08-01T10:00');
    const pagamentos = [pagamento('p1', 200, '2026-08', '2026-08-10T10:00'), pagamento('p2', 200, '2026-09', '2026-09-10T10:00')];
    const regras = regrasDaCompra({ compra: antiga, cartao: NUBANK, compras: [antiga], pagamentos, hoje: HOJE });
    assert.equal(regras.podeAlterarValor, true);
    assert.equal(regras.podeExcluir, true);
    assert.equal(regras.temHistorico, true);
    assert.ok(regras.aviso);

    const nova = compra('nova', 100, 1, '2026-10-12T15:00');
    const regrasNova = regrasDaCompra({ compra: nova, cartao: NUBANK, compras: [nova], pagamentos: [], hoje: HOJE });
    assert.equal(regrasNova.temHistorico, false);
    assert.equal(regrasNova.aviso, null);

    // Excluída a compra paga: o caixa (pagamentos) não muda; a dívida nunca fica negativa.
    const caixa = [receita(5000), ...pagamentos];
    assert.equal(saldo(caixa), 460000);
    const r = resumoDoCartao({ cartao: NUBANK, compras: [], pagamentos, hoje: HOJE });
    assert.equal(r.dividaCentavos, 0);
    assert.equal(r.limiteDisponivelCentavos, 500000);
  });
});

describe('invariantes anti-double-counting', () => {
  test('compras nunca alteram o saldo; dívida + pago = Σ parcelas', () => {
    const compras = [compra('a', 1200, 6, '2026-08-01T10:00'), compra('b', 333.33, 3, '2026-10-02T10:00'), compra('c', 50, 1, '2026-10-12T10:00')];
    const pagamentos = [pagamento('p1', 200, '2026-08', '2026-08-10T10:00'), pagamento('p2', 500, '2026-09', '2026-09-10T10:00')];
    const caixa = [receita(5000), ...pagamentos, { id: 'pix', tipo: 'despesa', valor: 80, data: '2026-10-05T10:00' }];
    // Parcela legada do modelo antigo, se ainda existir em `transacoes`, não é caixa.
    const legada = { id: 'leg', tipo: 'despesa', valor: 999, data: '2026-10-01T10:00', origem: 'cartao' };

    assert.equal(saldo([...caixa, legada]), saldo(caixa));
    assert.equal(saldo(caixa), 500000 - 20000 - 50000 - 8000);

    const r = resumoDoCartao({ cartao: NUBANK, compras, pagamentos, hoje: HOJE });
    const somaParcelas = compras.flatMap(parcelasDaCompra).reduce((a, p) => a + p.centavos, 0);
    const pago = r.faturas.reduce((a, f) => a + f.pagoCentavos, 0);
    assert.equal(r.dividaCentavos + pago, somaParcelas);
    assert.equal(pago, 70000);
  });
});

describe('parcelas', () => {
  test('arredondamento em centavos: 100/3 = 33,34 + 33,33 + 33,33', () => {
    assert.deepEqual(gerarValoresParcelas(10000, 3), [3334, 3333, 3333]);
    assert.equal(gerarValoresParcelas(33333, 7).reduce((a, b) => a + b), 33333);
  });

  test('cronograma explícito prevalece sobre o derivado', () => {
    const c = { ...compra('x', 100, 2, '2026-10-12T10:00'), parcelas: [{ competencia: '2026-11', valor: 70 }, { competencia: '2026-12', valor: 30 }] };
    assert.deepEqual(parcelasDaCompra(c).map((p) => p.centavos), [7000, 3000]);
  });
});

describe('ciclo de fechamento e vencimento', () => {
  test('compra no dia do fechamento vai para a fatura seguinte', () => {
    assert.equal(calcularPrimeiraCompetencia(new Date(2026, 9, 2, 23, 59), 3), '2026-10');
    assert.equal(calcularPrimeiraCompetencia(new Date(2026, 9, 3, 0, 1), 3), '2026-11');
  });

  test('fechamento 31 em fevereiro é clampado (dia 28 já é o fechamento)', () => {
    assert.equal(dataFechamento('2026-02', 31).getDate(), 28);
    assert.equal(calcularPrimeiraCompetencia(new Date(2026, 1, 28, 10), 31), '2026-03');
    assert.equal(calcularPrimeiraCompetencia(new Date(2026, 1, 27, 10), 31), '2026-02');
  });

  test('vence no mesmo mês quando vencimento > fechamento', () => {
    const v = dataVencimento('2026-10', { diaFechamento: 3, diaVencimento: 10 });
    assert.deepEqual([v.getFullYear(), v.getMonth(), v.getDate()], [2026, 9, 10]);
  });

  test('vence no mês seguinte quando vencimento ≤ fechamento (fecha 28, vence 5)', () => {
    const v = dataVencimento('2026-10', { diaFechamento: 28, diaVencimento: 5 });
    assert.deepEqual([v.getFullYear(), v.getMonth(), v.getDate()], [2026, 10, 5]);
    const dez = dataVencimento('2026-12', { diaFechamento: 28, diaVencimento: 5 });
    assert.deepEqual([dez.getFullYear(), dez.getMonth()], [2027, 0]);
  });

  test('vencimento 31 clampado no mês curto', () => {
    const v = dataVencimento('2026-01', { diaFechamento: 20, diaVencimento: 31 });
    assert.equal(v.getDate(), 31);
    const fev = dataVencimento('2026-01', { diaFechamento: 31, diaVencimento: 31 });
    assert.deepEqual([fev.getMonth(), fev.getDate()], [1, 28]);
  });

  test('statusCiclo nas fronteiras', () => {
    const c = { diaFechamento: 3, diaVencimento: 10 };
    assert.equal(statusCiclo('2026-10', c, new Date(2026, 9, 2, 23, 59)), 'aberta');
    assert.equal(statusCiclo('2026-10', c, new Date(2026, 9, 3, 0, 0)), 'fechada');
    assert.equal(statusCiclo('2026-10', c, new Date(2026, 9, 10, 23, 59)), 'fechada');
    assert.equal(statusCiclo('2026-10', c, new Date(2026, 9, 11, 0, 0)), 'vencida');
  });

  test('vencida + parcialmente paga é representável (duas dimensões)', () => {
    const c = compra('c', 1000, 1, '2026-08-20T10:00'); // competência 2026-09, vence 10/set
    const { faturas } = faturasDoCartao({ cartao: NUBANK, compras: [c], pagamentos: [pagamento('p', 300, '2026-09', '2026-09-08T10:00')], hoje: HOJE });
    assert.equal(faturas[0].statusCiclo, 'vencida');
    assert.equal(faturas[0].statusPagamento, 'parcial');
  });
});

describe('alocação de pagamentos', () => {
  const totais = { '2026-09': 50000, '2026-10': 50000, '2026-11': 50000 };

  test('excedente antecipa competências seguintes em ordem cronológica', () => {
    const { porCompetencia, porPagamento } = alocarPagamentos(totais, [{ id: 'a', data: '2026-09-01', competencia: '2026-09', centavos: 80000 }]);
    assert.equal(porCompetencia['2026-09'].restanteCentavos, 0);
    assert.equal(porCompetencia['2026-10'].pagoCentavos, 30000);
    assert.equal(porCompetencia['2026-11'].pagoCentavos, 0);
    assert.deepEqual(porPagamento.a.alocacoes, [{ competencia: '2026-09', centavos: 50000 }, { competencia: '2026-10', centavos: 30000 }]);
  });

  test('nunca volta para competência anterior à informada', () => {
    const { porCompetencia, porPagamento } = alocarPagamentos(totais, [{ id: 'a', data: '2026-10-01', competencia: '2026-11', centavos: 60000 }]);
    assert.equal(porCompetencia['2026-09'].pagoCentavos, 0);
    assert.equal(porCompetencia['2026-10'].pagoCentavos, 0);
    assert.equal(porPagamento.a.naoAlocadoCentavos, 10000);
  });

  test('determinística: ordem por data e, no empate, por id — independe da ordem de entrada', () => {
    const p = [
      { id: 'z', data: '2026-09-05', competencia: '2026-09', centavos: 40000 },
      { id: 'b', data: '2026-09-05', competencia: '2026-09', centavos: 40000 },
      { id: 'a', data: '2026-09-01', competencia: '2026-10', centavos: 10000 },
    ];
    const r1 = alocarPagamentos(totais, p);
    const r2 = alocarPagamentos(totais, [...p].reverse());
    assert.deepEqual(r1, r2);
    assert.deepEqual(r1.porPagamento.b.alocacoes, [{ competencia: '2026-09', centavos: 40000 }]);
    assert.deepEqual(r1.porPagamento.z.alocacoes, [{ competencia: '2026-09', centavos: 10000 }, { competencia: '2026-10', centavos: 30000 }]);
  });

  test('editar/excluir pagamento recalcula toda a alocação', () => {
    const base = [{ id: 'a', data: '2026-09-01', competencia: '2026-09', centavos: 80000 }];
    assert.equal(alocarPagamentos(totais, base).porCompetencia['2026-10'].pagoCentavos, 30000);
    assert.equal(alocarPagamentos(totais, [{ ...base[0], centavos: 50000 }]).porCompetencia['2026-10'].pagoCentavos, 0);
    assert.equal(alocarPagamentos(totais, []).porCompetencia['2026-09'].pagoCentavos, 0);
  });
});

describe('limites do pagamento', () => {
  const compras = [compra('a', 500, 1, '2026-10-12T15:00'), compra('b', 1000, 2, '2026-10-12T15:00')]; // nov: 1000, dez: 500

  test('máximo = restante da fatura alvo e seguintes (≤ dívida total)', () => {
    const args = { cartao: NUBANK, compras, pagamentos: [], hoje: HOJE };
    assert.equal(maximoPagamentoCentavos({ ...args, competencia: '2026-11' }), 150000);
    assert.equal(maximoPagamentoCentavos({ ...args, competencia: '2026-12' }), 50000);
  });

  test('pagamento acima da dívida total é bloqueado; acima do restante da fatura é permitido', () => {
    const base = { saldoFinanceiroCentavos: 10000000, saldoDisponivelCentavos: 10000000 };
    assert.equal(validarPagamento({ ...base, valorCentavos: 200000, maximoCentavos: 150000 }).ok, false);
    assert.equal(validarPagamento({ ...base, valorCentavos: 120000, maximoCentavos: 150000 }).ok, true);
    assert.equal(validarPagamento({ ...base, valorCentavos: 0, maximoCentavos: 150000 }).ok, false);
  });

  test('na edição o próprio pagamento sai da conta do máximo', () => {
    const pagamentos = [pagamento('pg', 1000, '2026-11')];
    const args = { cartao: NUBANK, compras, pagamentos, hoje: HOJE, competencia: '2026-11' };
    assert.equal(maximoPagamentoCentavos(args), 50000);
    assert.equal(maximoPagamentoCentavos({ ...args, ignorarPagamentoId: 'pg' }), 150000);
  });

  test('aviso usa_reservado quando cabe no saldo mas usa dinheiro de metas', () => {
    const v = validarPagamento({ valorCentavos: 50000, maximoCentavos: 50000, saldoFinanceiroCentavos: 80000, saldoDisponivelCentavos: 30000 });
    assert.deepEqual(v, { ok: true, aviso: 'usa_reservado' });
  });
});

test('gastos no cartão no mês usam a data da compra (consumo ≠ caixa)', () => {
  const compras = [compra('a', 300, 3, '2026-10-05T10:00'), compra('b', 100, 1, '2026-09-30T10:00')];
  assert.equal(gastosNoCartaoNoMes({ compras, cartaoId: 'nu', hoje: HOJE }), 30000);
});
