// SOMENTE LEITURA. Compara o saldo que o app calculava (janela móvel de 12 meses, comparação
// de string) com o saldo acumulado novo (dominio/caixa.js + dominio/tempo.js), derivando
// tudo dos documentos reais — nenhum resultado esperado é digitado aqui.
//   node scripts/saldo/validar-contra-firestore.mjs
//   node scripts/saldo/validar-contra-firestore.mjs --fixture=arquivo.json   (docs lidos antes, sem Firestore)
import fs from 'node:fs';
import { obterFirestoreAdmin, lerColecao } from '../cartoes-v2/admin.mjs';
import { janelaLegada, dentroDaJanela, saldoLegado } from '../cartoes-v2/legado.mjs';
import { calcularSaldoFinanceiroCentavos, calcularSaldoDisponivelCentavos, movimentacoesRealizadas, movimentacoesComDataInvalida, resumoDoHero } from '../../src/dominio/caixa.js';
import { paraTimestamp, paraInputLocal } from '../../src/dominio/tempo.js';

const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fixture = process.argv.find((a) => a.startsWith('--fixture='))?.slice('--fixture='.length);
const dadosFixture = fixture ? JSON.parse(fs.readFileSync(fixture, 'utf8')) : null;
const db = fixture ? null : obterFirestoreAdmin();
const [transacoes, metas] = fixture
  ? [dadosFixture.transacoes, dadosFixture.metas ?? []]
  : await Promise.all([lerColecao(db, 'transacoes'), lerColecao(db, 'metas')]);
const agora = dadosFixture?.agora ? new Date(dadosFixture.agora) : new Date();
if (fixture) console.log('(FIXTURE:', dadosFixture.origem, ')');

// O que o app fazia: só carregava a janela (query por string) e somava receitas − despesas.
const janela = janelaLegada(agora);
const carregadasPeloAppAntigo = transacoes.filter((t) => dentroDaJanela(t, janela));
const saldoAntigo = saldoLegado(transacoes, janela);

const saldoNovo = calcularSaldoFinanceiroCentavos(transacoes, agora);
const realizadas = movimentacoesRealizadas(transacoes, agora);
const idsAntigos = new Set(carregadasPeloAppAntigo.map((t) => t.id));
const antesIgnoradas = realizadas.filter((t) => !idsAntigos.has(t.id));

// Prova independente: soma direta em centavos dos documentos, sem usar o domínio.
const manual = transacoes
  .filter((t) => t.origem !== 'cartao' && paraTimestamp(t.data) <= agora.getTime())
  .reduce((a, t) => a + (t.tipo === 'receita' ? 1 : -1) * Math.round(t.valor * 100), 0);

const reservado = metas.reduce((a, m) => a + Math.round((m.valorReservado ?? m.valorAtual ?? 0) * 100), 0);

console.log('=== Validação do saldo contra o Firestore real (somente leitura) ===');
console.log('agora:', agora.toISOString(), '| transações:', transacoes.length, '| metas:', metas.length);
console.log('janela do app antigo:', janela.inicioISO, '→', janela.fimISO);
console.log('carregadas pelo app antigo:', carregadasPeloAppAntigo.length, 'de', transacoes.length);
console.log('SALDO ANTIGO (janela 12 meses):', brl(saldoAntigo));
console.log('SALDO NOVO   (acumulado ≤ agora):', brl(saldoNovo));
console.log('soma direta independente do domínio:', brl(manual), '| confere com o domínio:', manual === saldoNovo);
console.log('saldo disponível novo (saldo − metas reservadas):', brl(calcularSaldoDisponivelCentavos(saldoNovo, reservado)));
console.log('datas inválidas (ficariam fora do saldo):', movimentacoesComDataInvalida(transacoes).length);
const hero = resumoDoHero(transacoes, agora);
console.log('Hero (últimos 12 meses): entradas', brl(hero.entradasCentavos), '| saídas', brl(hero.saidasCentavos));
console.log(`\nTransações que ANTES eram ignoradas pela janela e AGORA participam (${antesIgnoradas.length}):`);
console.table(
  antesIgnoradas
    .sort((a, b) => paraTimestamp(a.data) - paraTimestamp(b.data))
    .map((t) => ({ id: t.id, tipo: t.tipo, valor: t.valor, dataGravada: t.data, dataLocal: paraInputLocal(t.data), efeitoNoSaldo: brl((t.tipo === 'receita' ? 1 : -1) * Math.round(t.valor * 100)) }))
);
const somaEfeitos = antesIgnoradas.reduce((a, t) => a + (t.tipo === 'receita' ? 1 : -1) * Math.round(t.valor * 100), 0);
console.log('soma dos efeitos =', brl(somaEfeitos), '| saldo antigo + efeitos = saldo novo:', saldoAntigo + somaEfeitos === saldoNovo);
