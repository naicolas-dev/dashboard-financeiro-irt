// Testes do saldo acumulado e das métricas de período — `npm run test:dominio`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularSaldoFinanceiroCentavos,
  calcularSaldoDisponivelCentavos,
  movimentacoesRealizadas,
  movimentacoesComDataInvalida,
  resumoDoPeriodo,
  resumoDoHero,
  resultadoDoMesCentavos,
} from './caixa.js';
import { NATUREZA_PAGAMENTO_FATURA } from './cartoes.js';
import { compararPorTempoDesc } from './tempo.js';

const AGORA = new Date(2026, 9, 14, 12, 0, 0, 0); // 14/out/2026 12:00 local
const receita = (valor, data, id = `r${valor}${data}`) => ({ id, tipo: 'receita', valor, data });
const despesa = (valor, data, id = `d${valor}${data}`) => ({ id, tipo: 'despesa', valor, data });
const saldo = (transacoes, agora = AGORA) => calcularSaldoFinanceiroCentavos(transacoes, agora);

describe('saldo acumulado — não expira com a idade da movimentação', () => {
  test('1. receita com mais de 12 meses continua no saldo', () => {
    assert.equal(saldo([receita(10000, '2024-01-15T10:00')]), 1000000);
  });

  test('2. despesa com mais de 12 meses continua no saldo', () => {
    assert.equal(saldo([despesa(4000, '2024-02-10T10:00')]), -400000);
  });

  test('3. combinação de movimentos antigos + recentes (exemplo do pedido: +10.000 −4.000 = 6.000)', () => {
    const t = [receita(10000, '2024-01-15T10:00'), despesa(4000, '2024-02-10T10:00'), receita(250.5, '2026-10-01T09:00'), despesa(80.25, '2026-10-13T18:30')];
    assert.equal(saldo(t), 600000 + 25050 - 8025);
    assert.equal(saldo(t.slice(0, 2)), 600000); // mesmo sem nada em 2026
  });

  test('4. pagamento de fatura reduz o saldo', () => {
    const pagamento = { id: 'pg', tipo: 'despesa', valor: 200, data: '2026-10-10T10:00', natureza: NATUREZA_PAGAMENTO_FATURA, cartaoId: 'nu', competencia: '2026-10' };
    assert.equal(saldo([receita(5000, '2026-10-01T09:00'), pagamento]), 480000);
  });

  test('5. compra no cartão não reduz o saldo (nem a parcela legada do modelo antigo)', () => {
    const parcelaLegada = { id: 'leg', tipo: 'despesa', valor: 999, data: '2026-10-05T10:00', origem: 'cartao', cartaoId: 'nu', compraCartaoId: 'c' };
    // Compras do V2 nem existem em `transacoes` (vivem em comprasCartao); a legada é filtrada pelo seletor.
    assert.equal(saldo([receita(5000, '2026-10-01T09:00'), parcelaLegada]), 500000);
  });

  test('6. movimentação futura não entra no saldo atual', () => {
    const t = [receita(1000, '2026-10-01T09:00'), despesa(300, '2026-10-20T09:00'), receita(5000, '2027-01-01T00:00')];
    assert.equal(saldo(t), 100000);
    // …e entra quando o relógio chega nela:
    assert.equal(saldo(t, new Date(2026, 9, 20, 9, 0)), 70000);
  });

  test('7. movimentação exatamente no limite de "agora" entra', () => {
    assert.equal(saldo([receita(100, '2026-10-14T12:00')]), 10000);
    assert.equal(saldo([receita(100, '2026-10-14T12:01')]), 0);
  });

  test('8. histórico vazio = saldo 0', () => {
    assert.equal(saldo([]), 0);
  });

  test('9. todos os formatos reais (local sem tz + UTC com Z) entram no mesmo cálculo e comparam certo', () => {
    const t = [
      { id: '1', tipo: 'receita', valor: 3000, data: '2025-07-01T03:00:00.000Z' },
      { id: '2', tipo: 'despesa', valor: 600, data: '2025-07-01T03:00:00.000Z' },
      { id: '3', tipo: 'receita', valor: 650, data: '2025-07-01T10:17' },
      { id: '4', tipo: 'despesa', valor: 20, data: '2025-07-02T12:32' },
      { id: '5', tipo: 'receita', valor: 600, data: '2025-08-04T14:36' },
    ];
    assert.equal(saldo(t), 300000 - 60000 + 65000 - 2000 + 60000);
    // Fronteira entre formatos: Z e local no MESMO dia, comparados por instante real.
    const limite = new Date(Date.UTC(2025, 6, 1, 12, 0, 0)); // instante absoluto
    const doisFormatos = [
      { id: 'z', tipo: 'receita', valor: 100, data: '2025-07-01T11:00:00.000Z' }, // antes do limite
      { id: 'zz', tipo: 'receita', valor: 10, data: '2025-07-01T13:00:00.000Z' }, // depois
    ];
    assert.equal(saldo(doisFormatos, limite), 10000);
    assert.deepEqual(
      [{ id: 'a', data: '2025-07-01T10:17' }, { id: 'b', data: '2025-07-01T03:00:00.000Z' }].sort(compararPorTempoDesc).map((x) => x.id).length,
      2
    );
  });

  test('10. saldoDisponivel = saldoFinanceiro − metas reservadas (e meta não é transação)', () => {
    const t = [receita(6125, '2025-07-01T10:00')];
    const sf = saldo(t);
    assert.equal(calcularSaldoDisponivelCentavos(sf, 100000), 512500);
    assert.equal(calcularSaldoDisponivelCentavos(sf, 0), sf);
    // Guardar/retirar mexe só em `valorReservado`: o saldo financeiro continua o mesmo.
    assert.equal(saldo(t), sf);
  });
});

describe('robustez do saldo', () => {
  test('centavos sem erro de ponto flutuante (0,1 + 0,2)', () => {
    assert.equal(saldo([receita(0.1, '2026-01-01T10:00'), receita(0.2, '2026-01-02T10:00')]), 30);
  });

  test('data inválida fica fora do saldo (e é detectável), nunca vira "hoje"', () => {
    const ruins = [receita(500, 'lixo', 'x'), despesa(10, '', 'y')];
    assert.equal(saldo([...ruins, receita(100, '2026-01-01T10:00')]), 10000);
    assert.deepEqual(movimentacoesComDataInvalida(ruins).map((t) => t.id), ['x', 'y']);
  });

  test('tipo desconhecido não afeta o saldo', () => {
    assert.equal(saldo([{ id: 'o', tipo: 'transferencia', valor: 999, data: '2026-01-01T10:00' }]), 0);
  });

  test('saldo não depende de quais documentos a tela mostra (ordem, filtro, recorte)', () => {
    const t = [receita(1000, '2024-01-01T10:00'), despesa(250, '2025-03-05T10:00'), receita(40, '2026-10-02T10:00')];
    const total = saldo(t);
    assert.equal(saldo([...t].reverse()), total);
    assert.equal(saldo([...t].sort(compararPorTempoDesc)), total);
    // O que a Home mostra (5 mais recentes) ou um filtro de período não muda o saldo calculado sobre todo o livro.
    assert.equal(saldo([...t].sort(compararPorTempoDesc).slice(0, 1)) === total, false);
    assert.equal(saldo(t), total);
  });

  test('movimentacoesRealizadas respeita o seletor de caixa e o relógio', () => {
    const t = [receita(1, '2026-10-01T10:00', 'ok'), receita(1, '2026-11-01T10:00', 'futura'), { id: 'leg', tipo: 'despesa', valor: 1, data: '2026-10-01T10:00', origem: 'cartao' }];
    assert.deepEqual(movimentacoesRealizadas(t, AGORA).map((x) => x.id), ['ok']);
  });
});

describe('métricas de período — Entradas/Saídas ≠ saldo', () => {
  const t = [
    receita(10000, '2024-01-15T10:00'), // antiga: no saldo, fora do Hero (12 meses)
    despesa(4000, '2024-02-10T10:00'),
    receita(2000, '2025-11-20T10:00'), // dentro dos 12 meses
    despesa(500, '2026-03-05T10:00'),
    receita(300, '2026-10-02T10:00'), // mês atual
    despesa(120, '2026-10-12T10:00'),
    despesa(900, '2026-10-30T10:00'), // futura
  ];

  test('Hero: só últimos 12 meses e só realizadas — o saldo continua acumulado', () => {
    const { entradasCentavos, saidasCentavos } = resumoDoHero(t, AGORA);
    assert.equal(entradasCentavos, 230000);
    assert.equal(saidasCentavos, 62000);
    assert.equal(saldo(t), 1000000 - 400000 + 200000 - 50000 + 30000 - 12000); // 768000 ≠ 230000−62000
    assert.notEqual(entradasCentavos - saidasCentavos, saldo(t));
  });

  test('receita ATUAL: aumenta o saldo e as Entradas (conceitos independentes, mesma magnitude)', () => {
    const antes = { saldo: saldo(t), entradas: resumoDoHero(t, AGORA).entradasCentavos };
    const nova = [...t, receita(100, '2026-10-14T11:00')];
    assert.equal(saldo(nova) - antes.saldo, 10000);
    assert.equal(resumoDoHero(nova, AGORA).entradasCentavos - antes.entradas, 10000);
  });

  test('receita ANTIGA: aumenta o saldo mas NÃO as Entradas do Hero', () => {
    const nova = [...t, receita(100, '2023-05-01T10:00')];
    assert.equal(saldo(nova) - saldo(t), 10000);
    assert.equal(resumoDoHero(nova, AGORA).entradasCentavos, resumoDoHero(t, AGORA).entradasCentavos);
  });

  test('movimentação futura não entra nem no saldo nem nas métricas', () => {
    assert.equal(resumoDoHero([...t, despesa(5000, '2027-01-01T10:00')], AGORA).saidasCentavos, 62000);
  });

  test('resumoDoPeriodo respeita início e fim; fim nunca passa de agora', () => {
    const r = resumoDoPeriodo(t, { inicio: '2026-10-01', fim: '2026-12-31', agora: AGORA });
    assert.equal(r.entradasCentavos, 30000);
    assert.equal(r.saidasCentavos, 12000); // a de 30/out (futura) fica de fora
  });

  test('resultado do mês usa o mês LOCAL e só o realizado', () => {
    assert.equal(resultadoDoMesCentavos(t, AGORA), 30000 - 12000);
    // Noite do último dia do mês: o mês local ainda é outubro (não o mês em UTC).
    const fimDeOutubro = new Date(2026, 9, 31, 23, 30);
    assert.equal(resultadoDoMesCentavos([receita(10, '2026-10-31T23:00')], fimDeOutubro), 1000);
  });
});
