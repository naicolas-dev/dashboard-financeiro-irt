// Testes da autoridade temporal — `npm run test:dominio`.
// Esperados montados com new Date(a, m, d, h, min) / Date.UTC: independem do fuso da máquina.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  paraTimestamp,
  ehDataValida,
  jaOcorreu,
  compararPorTempoDesc,
  paraInputLocal,
  mesLocal,
  inicioDoDiaLocal,
  fimDoDiaLocal,
  inicioDoDiaHaMeses,
  ehCompetenciaValida,
  ultimoDiaDoMes,
  somarMesesCompetencia,
  dataNoMes,
  paraDataISO,
} from './tempo.js';

const local = (a, m, d, h = 0, min = 0, s = 0, ms = 0) => new Date(a, m - 1, d, h, min, s, ms).getTime();

describe('paraTimestamp — formatos reais do Firestore', () => {
  test("'YYYY-MM-DDTHH:mm' sem timezone = hora LOCAL (formulários)", () => {
    assert.equal(paraTimestamp('2025-08-04T14:35'), local(2025, 8, 4, 14, 35));
  });

  test("ISO UTC com Z ('…T03:00:00.000Z', geradas por toISOString) = instante absoluto", () => {
    assert.equal(paraTimestamp('2025-07-01T03:00:00.000Z'), Date.UTC(2025, 6, 1, 3, 0, 0));
  });

  test('ISO com offset (Open Finance), com e sem dois-pontos', () => {
    assert.equal(paraTimestamp('2025-07-01T00:00:00-03:00'), Date.UTC(2025, 6, 1, 3, 0, 0));
    assert.equal(paraTimestamp('2025-07-01T00:00:00-0300'), Date.UTC(2025, 6, 1, 3, 0, 0));
    assert.equal(paraTimestamp('2025-07-01T12:00:00+05:30'), Date.UTC(2025, 6, 1, 6, 30, 0));
  });

  test('segundos e frações sem timezone continuam locais', () => {
    assert.equal(paraTimestamp('2025-08-04T14:35:20'), local(2025, 8, 4, 14, 35, 20));
    assert.equal(paraTimestamp('2025-08-04T14:35:20.250'), local(2025, 8, 4, 14, 35, 20, 250));
  });

  test('só-data = meia-noite LOCAL (não meia-noite UTC)', () => {
    assert.equal(paraTimestamp('2026-10-01'), local(2026, 10, 1));
  });

  test('Date, número e Timestamp do Firestore', () => {
    const d = new Date(2026, 9, 14, 10, 30);
    assert.equal(paraTimestamp(d), d.getTime());
    assert.equal(paraTimestamp(1700000000000), 1700000000000);
    assert.equal(paraTimestamp({ toMillis: () => 1700000000123 }), 1700000000123);
    assert.equal(paraTimestamp({ seconds: 1700000000, nanoseconds: 500000000 }), 1700000000500);
  });

  test('inválidos viram NaN (nunca 0, nunca "data de hoje")', () => {
    for (const ruim of [null, undefined, '', 'abc', '2026-13-01', '2026-02-31', '2026-10-14T25:00', '2026-10-14T10:61', {}, NaN, true]) {
      assert.ok(Number.isNaN(paraTimestamp(ruim)), `esperava NaN para ${String(ruim)}`);
      assert.equal(ehDataValida(ruim), false);
    }
    assert.ok(ehDataValida('2024-02-29T10:00')); // bissexto
    assert.ok(Number.isNaN(paraTimestamp('2025-02-29T10:00'))); // não bissexto
  });
});

describe('comparação temporal (a armadilha da comparação de string)', () => {
  test("'…T02:00' local (= 05:00Z em Brasília) é DEPOIS de '…T03:00:00.000Z' — string diria o contrário", () => {
    const aLocal = '2025-07-01T02:00';
    const bZ = '2025-07-01T03:00:00.000Z';
    // Prova do problema: por string, o local "vem antes".
    assert.ok(aLocal < bZ);
    // Por tempo real (fuso de Brasília, UTC-3): 02:00 local = 05:00Z > 03:00Z.
    if (new Date(2025, 6, 1).getTimezoneOffset() === 180) {
      assert.ok(paraTimestamp(aLocal) > paraTimestamp(bZ));
    }
    // Em qualquer fuso, a ordenação segue o instante real:
    const ordenadas = [{ id: 'a', data: aLocal }, { id: 'b', data: bZ }].sort(compararPorTempoDesc).map((x) => x.id);
    const esperado = paraTimestamp(aLocal) > paraTimestamp(bZ) ? ['a', 'b'] : ['b', 'a'];
    assert.deepEqual(ordenadas, esperado);
  });

  test('os 12 documentos reais (2 formatos) ordenam por tempo real, desempate por id', () => {
    const reais = [
      { id: '1', data: '2025-07-01T03:00:00.000Z' },
      { id: '2', data: '2025-07-01T10:17' },
      { id: '3', data: '2025-08-01T03:00:00.000Z' },
      { id: '4', data: '2025-08-04T14:35' },
      { id: '5', data: '2025-08-04T14:36' },
    ];
    const desc = [...reais].sort(compararPorTempoDesc).map((x) => x.id);
    assert.deepEqual(desc, ['5', '4', '3', '2', '1']);
    const embaralhado = [reais[3], reais[0], reais[4], reais[2], reais[1]].sort(compararPorTempoDesc).map((x) => x.id);
    assert.deepEqual(embaralhado, desc);
  });

  test('empate de instante desempata por id (estável); inválidas por último', () => {
    const lista = [
      { id: 'b', data: '2026-01-01T10:00' },
      { id: 'x', data: 'lixo' },
      { id: 'a', data: '2026-01-01T10:00' },
    ];
    assert.deepEqual(lista.sort(compararPorTempoDesc).map((t) => t.id), ['a', 'b', 'x']);
  });

  test('jaOcorreu: exatamente em `agora` conta; um milissegundo depois não', () => {
    const agora = new Date(2026, 9, 14, 12, 0, 0, 0);
    assert.equal(jaOcorreu('2026-10-14T12:00', agora), true);
    assert.equal(jaOcorreu('2026-10-14T12:01', agora), false);
    assert.equal(jaOcorreu('2026-10-14T11:59', agora), true);
    assert.equal(jaOcorreu('lixo', agora), false);
  });
});

describe('derivados de tempo', () => {
  test('paraInputLocal: doc local fica igual; doc em UTC vira a hora LOCAL (não a UTC)', () => {
    assert.equal(paraInputLocal('2025-08-04T14:35'), '2025-08-04T14:35');
    assert.equal(paraInputLocal('2025-08-04T14:35:59'), '2025-08-04T14:35');
    const ts = Date.UTC(2025, 6, 1, 3, 0, 0);
    // Mesma coisa que ler a hora local do instante — o contrário de `slice(0,16)` (UTC).
    assert.equal(paraInputLocal('2025-07-01T03:00:00.000Z'), paraInputLocal(new Date(ts)));
    if (new Date(ts).getTimezoneOffset() === 180) {
      assert.equal(paraInputLocal('2025-07-01T03:00:00.000Z'), '2025-07-01T00:00'); // meia-noite de Brasília
      assert.notEqual(paraInputLocal('2025-07-01T03:00:00.000Z'), '2025-07-01T03:00:00.000Z'.slice(0, 16));
    }
    assert.equal(paraInputLocal('lixo'), '');
  });

  test('mesLocal usa o mês LOCAL, nunca o UTC', () => {
    assert.equal(mesLocal('2026-10-31T23:30'), '2026-10');
    assert.equal(mesLocal(new Date(2026, 9, 31, 23, 30)), '2026-10');
    assert.equal(mesLocal(new Date(2026, 10, 1, 0, 10)), '2026-11');
  });

  test('início/fim do dia local (inclusive só-data)', () => {
    assert.equal(inicioDoDiaLocal('2026-10-14T15:20'), local(2026, 10, 14));
    assert.equal(fimDoDiaLocal('2026-10-14T15:20'), local(2026, 10, 14, 23, 59, 59, 999));
    assert.equal(inicioDoDiaLocal('2026-10-14'), local(2026, 10, 14));
    assert.equal(fimDoDiaLocal('2026-10-14'), local(2026, 10, 14, 23, 59, 59, 999));
  });

  test('inicioDoDiaHaMeses: 12 meses atrás às 00:00 local', () => {
    assert.equal(inicioDoDiaHaMeses(new Date(2026, 9, 14, 17, 45), 12), local(2025, 10, 14));
  });
});

describe('competência e vencimentos', () => {
  test('ehCompetenciaValida', () => {
    assert.equal(ehCompetenciaValida('2026-10'), true);
    for (const x of ['2026-13', '2026-00', '2026-1', '26-10', '2026-10-01', null, 202610]) assert.equal(ehCompetenciaValida(x), false);
  });

  test('ultimoDiaDoMes respeita bissexto', () => {
    assert.equal(ultimoDiaDoMes(2026, 1), 28);
    assert.equal(ultimoDiaDoMes(2028, 1), 29);
    assert.equal(ultimoDiaDoMes(2026, 3), 30);
    assert.equal(ultimoDiaDoMes(2026, 11), 31);
  });

  test('somarMesesCompetencia atravessa o ano nos dois sentidos', () => {
    assert.equal(somarMesesCompetencia('2026-11', 2), '2027-01');
    assert.equal(somarMesesCompetencia('2026-01', -1), '2025-12');
    assert.equal(somarMesesCompetencia('2026-05', 0), '2026-05');
    assert.equal(somarMesesCompetencia('2026-01', 25), '2028-02');
  });

  test('dataNoMes ajusta dia 29/30/31 ao último dia do mês', () => {
    assert.equal(dataNoMes('2026-02', 31), '2026-02-28');
    assert.equal(dataNoMes('2024-02', 31), '2024-02-29');
    assert.equal(dataNoMes('2026-04', 31), '2026-04-30');
    assert.equal(dataNoMes('2026-10', 14), '2026-10-14');
  });

  test('paraDataISO usa o dia LOCAL', () => {
    assert.equal(paraDataISO('2026-10-14T23:30'), '2026-10-14');
    assert.equal(paraDataISO(new Date(2026, 9, 14, 0, 5)), '2026-10-14');
    assert.equal(paraDataISO('lixo'), '');
  });
});
