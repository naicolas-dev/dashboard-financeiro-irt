// Testes de Assinaturas em cartão — `npm run test:dominio`.
// "Banco" em memória que executa o domínio como os serviços executam no Firestore (criar se não existe).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  idCobranca,
  normalizarAssinatura,
  competenciasDeCobranca,
  cobrancasFaltantes,
  novaCobranca,
  proximaCobranca,
  planejarEdicao,
  planejarCancelamento,
  planejarExclusao,
  ehCobrancaDeAssinatura,
} from './assinaturasCartao.js';
import { faturasDoCartao, resumoDoCartao, calcularPrimeiraCompetencia, NATUREZA_PAGAMENTO_FATURA } from './cartoes.js';
import { calcularSaldoFinanceiroCentavos, movimentacoesRealizadas } from './caixa.js';

// Nubank fictício: fecha dia 20, vence dia 27. Limite R$ 5.000.
const NUBANK = { id: 'nu', nome: 'Nubank', limiteTotal: 5000, diaFechamento: 20, diaVencimento: 27 };
const AGORA = new Date(2026, 9, 15, 12, 0); // 15/out/2026 12:00
const assinatura = (extra = {}) => ({ id: 'a1', cartaoId: 'nu', descricao: 'Netflix', valor: 44.9, categoria: 'Lazer', diaDoMes: 15, ativa: true, primeiraCompetencia: '2026-07', ...extra });

function criarBanco({ assinaturas = [assinatura()], agora = AGORA } = {}) {
  const banco = { assinaturas: [...assinaturas], compras: new Map(), transacoes: [], agora };
  banco.gerar = () => {
    let criadas = 0;
    for (const c of cobrancasFaltantes({ assinaturas: banco.assinaturas, compras: [...banco.compras.values()], cartoes: [NUBANK], agora: banco.agora })) {
      if (!banco.compras.has(c.id)) {
        banco.compras.set(c.id, c);
        criadas++;
      }
    }
    return criadas;
  };
  banco.lista = () => [...banco.compras.values()].sort((a, b) => (a.competenciaCobranca < b.competenciaCobranca ? -1 : 1));
  banco.resumo = (pagamentos = []) => resumoDoCartao({ cartao: NUBANK, compras: banco.lista(), pagamentos, hoje: banco.agora });
  banco.saldo = () => calcularSaldoFinanceiroCentavos(banco.transacoes, banco.agora);
  return banco;
}

describe('geração idempotente', () => {
  test('1. e 4. criar assinatura não altera saldo nem cria transação de caixa', () => {
    const banco = criarBanco();
    assert.equal(banco.saldo(), 0);
    banco.gerar();
    assert.equal(banco.transacoes.length, 0);
    assert.equal(banco.saldo(), 0);
    assert.equal(movimentacoesRealizadas(banco.transacoes, AGORA).length, 0);
  });

  test('2. gera exatamente uma compra por competência (à vista, 1x)', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-10' })] });
    assert.equal(banco.gerar(), 1);
    const [c] = banco.lista();
    assert.deepEqual([c.id, c.numeroParcelas, c.valorTotal, c.cartaoId, c.dataCompra], ['a1_2026-10', 1, 44.9, 'nu', '2026-10-15T00:00']);
  });

  test('origem explícita (não depende da descrição) e vínculo com a assinatura', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-10' })] });
    banco.gerar();
    const [c] = banco.lista();
    assert.equal(c.descricao, 'Netflix'); // sem sufixo "(Assinatura)"
    assert.deepEqual([c.origem, c.assinaturaId, c.competenciaCobranca], ['assinatura', 'a1', '2026-10']);
    assert.equal(ehCobrancaDeAssinatura(c), true);
    assert.equal(idCobranca('a1', '2026-10'), c.id);
  });

  test('3. a compra gerada aumenta a dívida e reduz o limite do cartão', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-10' })] });
    assert.equal(banco.resumo().dividaCentavos, 0);
    banco.gerar();
    const r = banco.resumo();
    assert.equal(r.dividaCentavos, 4490);
    assert.equal(r.limiteDisponivelCentavos, 500000 - 4490);
  });

  test('5. e 6. reabrir (várias vezes) e duas execuções/abas não duplicam', () => {
    const banco = criarBanco();
    const primeira = banco.gerar();
    assert.equal(primeira, 4); // jul, ago, set, out (cobrança do dia 15 já aconteceu)
    for (let i = 0; i < 10; i++) assert.equal(banco.gerar(), 0);
    assert.equal(banco.compras.size, 4);
    // "duas abas": ambas calculam o mesmo faltante antes de qualquer escrita; a chave determinística colapsa.
    const b2 = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-10' })] });
    const aba1 = cobrancasFaltantes({ assinaturas: b2.assinaturas, compras: [], cartoes: [NUBANK], agora: AGORA });
    const aba2 = cobrancasFaltantes({ assinaturas: b2.assinaturas, compras: [], cartoes: [NUBANK], agora: AGORA });
    for (const c of [...aba1, ...aba2]) if (!b2.compras.has(c.id)) b2.compras.set(c.id, c);
    assert.equal(b2.compras.size, 1);
  });

  test('7. meses sem abrir são recuperados', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-07' })], agora: new Date(2026, 6, 20) });
    assert.equal(banco.gerar(), 1); // só julho existia
    banco.agora = new Date(2026, 9, 20); // três meses depois
    assert.equal(banco.gerar(), 3);
    assert.deepEqual(banco.lista().map((c) => c.competenciaCobranca), ['2026-07', '2026-08', '2026-09', '2026-10']);
  });

  test('cobrança futura NÃO é gerada (não consome limite antes da hora)', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-10', diaDoMes: 20 })] }); // dia 20, hoje 15
    assert.equal(banco.gerar(), 0);
    assert.equal(banco.resumo().dividaCentavos, 0);
    banco.agora = new Date(2026, 9, 20, 0, 1);
    assert.equal(banco.gerar(), 1);
    assert.equal(proximaCobranca(banco.assinaturas[0], banco.agora).competencia, '2026-11');
  });

  test('8. dia 29/30/31 faz clamp ao último dia do mês (nunca pula o mês)', () => {
    const a = assinatura({ diaDoMes: 31, primeiraCompetencia: '2026-01' });
    const datas = competenciasDeCobranca(a, new Date(2026, 3, 30, 23, 59)).map((c) => novaCobranca(a, NUBANK, c, AGORA).dataCompra);
    assert.deepEqual(datas, ['2026-01-31T00:00', '2026-02-28T00:00', '2026-03-31T00:00', '2026-04-30T00:00']);
    const bissexto = assinatura({ diaDoMes: 30, primeiraCompetencia: '2028-02' });
    assert.equal(novaCobranca(bissexto, NUBANK, '2028-02', AGORA).dataCompra, '2028-02-29T00:00');
  });

  test('primeira cobrança é dado explícito: não inventa retroativo; permite começar antes se pedido', () => {
    // criada no dia 20 com cobrança dia 5, primeira competência = padrão (próximo mês): nada retroativo
    const criada = assinatura({ diaDoMes: 5, primeiraCompetencia: '2026-11', criadaEm: new Date(2026, 9, 20).toISOString() });
    assert.deepEqual(competenciasDeCobranca(criada, new Date(2026, 9, 20)), []);
    // primeira competência explícita no passado (assinatura já em andamento) é respeitada
    assert.deepEqual(competenciasDeCobranca(assinatura({ primeiraCompetencia: '2026-08' }), AGORA), ['2026-08', '2026-09', '2026-10']);
    // legada/sem primeiraCompetencia: usa o padrão a partir da criação
    assert.equal(normalizarAssinatura({ id: 'x', diaDoMes: 5, valor: 10, criadaEm: new Date(2026, 9, 20).toISOString() }).primeiraCompetencia, '2026-11');
  });

  test('assinatura de cartão inexistente é ignorada', () => {
    assert.deepEqual(cobrancasFaltantes({ assinaturas: [assinatura({ cartaoId: 'fantasma' })], compras: [], cartoes: [NUBANK], agora: AGORA }), []);
  });
});

describe('cancelar, editar, excluir', () => {
  test('9. e 10. cancelar para futuras cobranças e o histórico permanece', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-01' })], agora: new Date(2026, 2, 20) }); // jan, fev, mar
    banco.gerar();
    assert.equal(banco.compras.size, 3);
    const plano = planejarCancelamento({ assinatura: banco.assinaturas[0], agora: banco.agora });
    assert.equal(plano.ok, true);
    assert.deepEqual(plano.patch, { ativa: false, encerradaEm: '2026-04' });
    banco.assinaturas[0] = { ...banco.assinaturas[0], ...plano.patch };
    banco.agora = new Date(2026, 5, 20); // abril, maio, junho passam
    assert.equal(banco.gerar(), 0);
    assert.deepEqual(banco.lista().map((c) => c.competenciaCobranca), ['2026-01', '2026-02', '2026-03']);
    assert.equal(banco.resumo().dividaCentavos, 3 * 4490); // dívida histórica intacta
  });

  test('cancelar ANTES da cobrança do mês: o mês corrente não gera', () => {
    const a = assinatura({ primeiraCompetencia: '2026-08', diaDoMes: 20 });
    const plano = planejarCancelamento({ assinatura: a, agora: AGORA }); // 15/out, cobrança dia 20 ainda não houve
    assert.equal(plano.patch.encerradaEm, '2026-10');
    assert.deepEqual(competenciasDeCobranca({ ...a, ...plano.patch }, new Date(2026, 11, 1)), ['2026-08', '2026-09']);
    assert.equal(planejarCancelamento({ assinatura: { ...a, ativa: false }, agora: AGORA }).motivo, 'ja_cancelada');
  });

  test('cancelar não esquece cobranças já devidas (serviço gera antes de cancelar)', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-07' })], agora: new Date(2026, 6, 20) });
    banco.gerar(); // só julho
    banco.agora = new Date(2026, 9, 20); // 3 meses sem abrir
    banco.gerar(); // o serviço gera ANTES de planejar o cancelamento
    const plano = planejarCancelamento({ assinatura: banco.assinaturas[0], agora: banco.agora });
    banco.assinaturas[0] = { ...banco.assinaturas[0], ...plano.patch };
    assert.equal(banco.compras.size, 4);
    assert.equal(plano.patch.encerradaEm, '2026-11');
  });

  test('11. e 12. editar não muda cobrança existente; a próxima usa o novo valor', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-10', valor: 39.9 })] });
    banco.gerar();
    const plano = planejarEdicao({ assinatura: banco.assinaturas[0], campos: { valor: 44.9 } });
    assert.equal(plano.ok, true);
    banco.assinaturas[0] = { ...banco.assinaturas[0], ...plano.patch };
    assert.equal(banco.gerar(), 0); // outubro já existe: não reescreve
    assert.equal(banco.compras.get('a1_2026-10').valorTotal, 39.9);
    banco.agora = new Date(2026, 10, 15, 8, 0);
    assert.equal(banco.gerar(), 1);
    assert.equal(banco.compras.get('a1_2026-11').valorTotal, 44.9);
    assert.equal(banco.resumo().dividaCentavos, 3990 + 4490);
  });

  test('editar valida campos e não aceita lixo', () => {
    const a = assinatura();
    assert.equal(planejarEdicao({ assinatura: a, campos: { valor: 0 } }).motivo, 'valor_invalido');
    assert.equal(planejarEdicao({ assinatura: a, campos: { descricao: '  ' } }).motivo, 'descricao_invalida');
    assert.equal(planejarEdicao({ assinatura: a, campos: { diaDoMes: 32 } }).motivo, 'dia_invalido');
    assert.equal(planejarEdicao({ assinatura: a, campos: { diaDoMes: 1.5 } }).motivo, 'dia_invalido');
    assert.equal(planejarEdicao({ assinatura: null, campos: {} }).motivo, 'inexistente');
  });

  test('13. excluir sem histórico funciona; 14. com histórico é bloqueado (orientar a encerrar)', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-10' })] });
    assert.equal(planejarExclusao({ assinatura: banco.assinaturas[0], compras: [] }).ok, true);
    banco.gerar();
    const bloqueada = planejarExclusao({ assinatura: banco.assinaturas[0], compras: banco.lista() });
    assert.deepEqual([bloqueada.ok, bloqueada.motivo], [false, 'tem_cobrancas']);
  });

  test('cobrança removida pelo usuário não é recriada (competenciasIgnoradas)', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-09' })] });
    banco.gerar();
    banco.compras.delete('a1_2026-09');
    banco.assinaturas[0] = { ...banco.assinaturas[0], competenciasIgnoradas: ['2026-09'] };
    assert.equal(banco.gerar(), 0);
    assert.deepEqual(banco.lista().map((c) => c.competenciaCobranca), ['2026-10']);
  });
});

describe('integração com Cartões V2 (fatura e caixa)', () => {
  test('15. a compra gerada cai na fatura certa pelo domínio atual (fechamento dia 20)', () => {
    // dia 15 → antes do fechamento (20): fatura do próprio mês; dia 25 → depois: fatura do mês seguinte
    const antes = novaCobranca(assinatura({ diaDoMes: 15 }), NUBANK, '2026-10', AGORA);
    const depois = novaCobranca(assinatura({ diaDoMes: 25 }), NUBANK, '2026-10', AGORA);
    assert.equal(antes.primeiraCompetencia, '2026-10');
    assert.equal(depois.primeiraCompetencia, '2026-11');
    assert.equal(antes.primeiraCompetencia, calcularPrimeiraCompetencia(new Date(2026, 9, 15), 20));
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-10', diaDoMes: 15 })] });
    banco.gerar();
    const { faturas } = faturasDoCartao({ cartao: NUBANK, compras: banco.lista(), pagamentos: [], hoje: AGORA });
    assert.deepEqual(faturas.map((f) => [f.competencia, f.totalCentavos]), [['2026-10', 4490]]);
  });

  test('16. o pagamento posterior da fatura é a ÚNICA saída de caixa', () => {
    const banco = criarBanco({ assinaturas: [assinatura({ primeiraCompetencia: '2026-09' })] }); // set e out
    banco.gerar();
    assert.equal(banco.saldo(), 0);
    banco.transacoes.push({ id: 'pg1', tipo: 'despesa', valor: 44.9, data: '2026-10-10T09:00', natureza: NATUREZA_PAGAMENTO_FATURA, cartaoId: 'nu', competencia: '2026-09' });
    assert.equal(banco.saldo(), -4490); // só o pagamento mexe no caixa
    const r = banco.resumo(banco.transacoes);
    assert.equal(r.dividaCentavos, 4490); // 2 cobranças − 1 pagamento
    assert.equal(banco.transacoes.length, 1);
    assert.ok(banco.transacoes.every((t) => t.natureza === NATUREZA_PAGAMENTO_FATURA));
  });

  test('limite: a cobrança é gerada mesmo estourando o limite (realidade do cartão), sem sumir', () => {
    const apertado = { ...NUBANK, limiteTotal: 30 };
    const faltantes = cobrancasFaltantes({ assinaturas: [assinatura({ primeiraCompetencia: '2026-10' })], compras: [], cartoes: [apertado], agora: AGORA });
    assert.equal(faltantes.length, 1);
    const r = resumoDoCartao({ cartao: apertado, compras: faltantes, pagamentos: [], hoje: AGORA });
    assert.equal(r.limiteDisponivelCentavos, 3000 - 4490); // negativo, visível
  });
});
