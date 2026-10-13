// Migração Cartões V2 — PADRÃO É DRY-RUN (nenhuma escrita no Firestore).
//
//   node scripts/cartoes-v2/migrar.mjs [pasta-de-saida]                    → dry-run
//   node scripts/cartoes-v2/migrar.mjs [pasta] --aplicar --confirmo-escrita → escreve
//
// O que a migração faz (critério aprovado no plano):
//   1. Parcelas legadas (`transacoes` com origem 'cartao') deixam de ser caixa no app
//      novo. As que o app antigo JÁ contava no saldo (data ≤ fim da janela antiga,
//      hoje + 1 dia) ganham um pagamento de fatura sintético por (cartão, competência,
//      data) — mesma data, então a janela de 12 meses inclui/exclui o pagamento nos
//      mesmos dias em que incluía/excluía as parcelas. O saldo exibido não muda.
//   2. Compras cujo cronograma gravado diverge do derivado (parcela editada/excluída
//      individualmente) recebem `parcelas` explícito = exatamente o que estava gravado.
//   3. Parcelas órfãs (sem compra) não viram pagamento (não há dívida pra quitar):
//      viram despesa de caixa comum com o mesmo valor/data — o saldo também não muda.
// Nada é excluído aqui. Limpeza das parcelas legadas é etapa separada.
import fs from 'node:fs';
import path from 'node:path';
import { obterFirestoreAdmin, lerColecao } from './admin.mjs';
import { gerarValoresParcelasLegado, adicionarMesesLegado, janelaLegada, saldoLegado } from './legado.mjs';
import { resumoDoCartao, NATUREZA_PAGAMENTO_FATURA, movimentacoesDeCaixa } from '../../src/dominio/cartoes.js';

const MARCA = 'cartoes-v2';
const args = process.argv.slice(2);
// --fixture=arquivo.json: lê os dados de um arquivo em vez do Firestore (validação do
// algoritmo com dados legados sintéticos). Nunca aplica.
const fixture = args.find((a) => a.startsWith('--fixture='))?.slice('--fixture='.length);
const aplicar = !fixture && args.includes('--aplicar') && args.includes('--confirmo-escrita');
const pastaSaida = args.find((a) => !a.startsWith('--')) ?? path.join(process.cwd(), 'scripts', 'cartoes-v2', '.saida');
fs.mkdirSync(pastaSaida, { recursive: true });

const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const centavos = (v) => Math.round(v * 100);

const db = fixture ? null : obterFirestoreAdmin();
const dadosFixture = fixture ? JSON.parse(fs.readFileSync(fixture, 'utf8')) : null;
const [cartoes, compras, transacoes] = fixture
  ? [dadosFixture.cartoes, dadosFixture.comprasCartao, dadosFixture.transacoes]
  : await Promise.all([lerColecao(db, 'cartoes'), lerColecao(db, 'comprasCartao'), lerColecao(db, 'transacoes')]);
const agora = dadosFixture?.agora ? new Date(dadosFixture.agora) : new Date();
const janela = janelaLegada(agora);

const cartaoPorId = new Map(cartoes.map((c) => [c.id, c]));
const compraPorId = new Map(compras.map((c) => [c.id, c]));
const legadas = transacoes.filter((t) => t.origem === 'cartao');
const jaMigrados = transacoes.filter((t) => t.migracao === MARCA);
const chavesJaCobertas = new Set(jaMigrados.map((t) => t.chaveMigracao));

// ---- 2. compras com cronograma explícito
const comprasComCronograma = [];
for (const compra of compras) {
  if (Array.isArray(compra.parcelas) && compra.parcelas.length) continue; // idempotente
  const gravadas = legadas.filter((p) => p.compraCartaoId === compra.id).sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
  if (gravadas.length === 0) continue; // compra nova (V2) ou sem parcelas legadas: derivado padrão
  const derivadas = gerarValoresParcelasLegado(centavos(compra.valorTotal), compra.numeroParcelas).map((v, i) => ({
    competencia: adicionarMesesLegado(compra.primeiraCompetencia, i),
    centavos: v,
  }));
  const igual =
    gravadas.length === derivadas.length && gravadas.every((p, i) => p.competencia === derivadas[i].competencia && centavos(p.valor) === derivadas[i].centavos);
  if (!igual) {
    comprasComCronograma.push({
      compraId: compra.id,
      descricao: compra.descricao,
      antes: { valorTotal: compra.valorTotal, numeroParcelas: compra.numeroParcelas, parcelas: compra.parcelas ?? null },
      parcelas: gravadas.map((p) => ({ competencia: p.competencia, valor: p.valor })),
    });
  }
}

// ---- 1 e 3. pagamentos sintéticos / despesas equivalentes para órfãs
const grupos = new Map();
const orfas = [];
for (const p of legadas) {
  if (p.data > janela.fimISO) continue; // ainda não contada no saldo antigo → vira dívida aberta
  if (!compraPorId.has(p.compraCartaoId) || !cartaoPorId.has(p.cartaoId)) {
    orfas.push(p);
    continue;
  }
  const chave = `${p.cartaoId}|${p.competencia}|${p.data}`;
  const g = grupos.get(chave) ?? { chave, cartaoId: p.cartaoId, competencia: p.competencia, data: p.data, centavos: 0, parcelaIds: [] };
  g.centavos += centavos(p.valor);
  g.parcelaIds.push(p.id);
  grupos.set(chave, g);
}

const pagamentosSinteticos = [...grupos.values()]
  .filter((g) => !chavesJaCobertas.has(g.chave))
  .map((g) => ({
    descricao: `Pagamento da fatura • ${cartaoPorId.get(g.cartaoId).nome}`,
    valor: g.centavos / 100,
    tipo: 'despesa',
    categoria: 'Fatura do cartão',
    data: g.data,
    natureza: NATUREZA_PAGAMENTO_FATURA,
    cartaoId: g.cartaoId,
    competencia: g.competencia,
    migracao: MARCA,
    chaveMigracao: g.chave,
    parcelasLegadasCobertas: g.parcelaIds,
  }));

const despesasDeOrfas = orfas
  .filter((p) => !chavesJaCobertas.has(`orfa|${p.id}`))
  .map((p) => ({
    descricao: p.descricao,
    valor: p.valor,
    tipo: 'despesa',
    categoria: p.categoria,
    data: p.data,
    migracao: MARCA,
    chaveMigracao: `orfa|${p.id}`,
  }));

// ---- prova de equivalência do saldo
const saldoAntigo = saldoLegado(transacoes, janela);
const transacoesDepois = [...transacoes, ...pagamentosSinteticos, ...despesasDeOrfas];
const saldoNovo = saldoLegado(movimentacoesDeCaixa(transacoesDepois), janela);

// Também em instantes futuros: a parte "já contada" do modelo antigo tem que sair da
// janela nos mesmos dias que os pagamentos sintéticos. (Parcelas futuras divergem
// de propósito: no modelo novo só viram caixa quando a fatura for paga.)
const conferenciaFutura = [];
for (const meses of [1, 3, 6, 12, 13, 24]) {
  const t = new Date(agora);
  t.setMonth(t.getMonth() + meses);
  const j = janelaLegada(t);
  const cobertas = legadas.filter((p) => p.data <= janela.fimISO);
  const somaAntiga = saldoLegado(cobertas, j);
  const somaNova = saldoLegado([...pagamentosSinteticos, ...despesasDeOrfas, ...jaMigrados], j);
  conferenciaFutura.push({ daquiAMeses: meses, parcelasCobertasCentavos: somaAntiga, substitutosCentavos: somaNova, igual: somaAntiga === somaNova });
}

// ---- dívida projetada por cartão (domínio novo) depois da migração
const comprasDepois = compras.map((c) => {
  const ajuste = comprasComCronograma.find((x) => x.compraId === c.id);
  return ajuste ? { ...c, parcelas: ajuste.parcelas } : c;
});
const pagamentosDepois = [...transacoes.filter((t) => t.natureza === NATUREZA_PAGAMENTO_FATURA), ...pagamentosSinteticos.map((p, i) => ({ ...p, id: `novo-${i}` }))];
const dividaProjetada = cartoes.map((cartao) => {
  const r = resumoDoCartao({ cartao, compras: comprasDepois, pagamentos: pagamentosDepois, hoje: agora });
  return {
    cartao: cartao.nome,
    divida: brl(r.dividaCentavos),
    faturaAtual: brl(r.faturaAtualCentavos),
    proximasParcelas: brl(r.proximasParcelasCentavos),
    limiteDisponivel: brl(r.limiteDisponivelCentavos),
  };
});

const equivalente = saldoAntigo === saldoNovo && conferenciaFutura.every((c) => c.igual);
const plano = {
  modo: aplicar ? 'APLICAR' : fixture ? 'DRY-RUN (fixture)' : 'DRY-RUN',
  geradoEm: agora.toISOString(),
  janelaLegada: janela,
  leitura: { cartoes: cartoes.length, comprasCartao: compras.length, transacoes: transacoes.length, parcelasLegadas: legadas.length, jaMigrados: jaMigrados.length },
  escritas: {
    criarPagamentosSinteticos: pagamentosSinteticos,
    criarDespesasDeParcelasOrfas: despesasDeOrfas,
    atualizarComprasComCronogramaExplicito: comprasComCronograma,
    exclusoes: [],
  },
  saldo: { antigo: brl(saldoAntigo), novo: brl(saldoNovo), antigoCentavos: saldoAntigo, novoCentavos: saldoNovo, equivalente },
  conferenciaFutura,
  dividaProjetada,
};

const arquivo = path.join(pastaSaida, `migracao-cartoes-v2-${aplicar ? 'aplicar' : 'dryrun'}-${agora.toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(arquivo, JSON.stringify(plano, null, 2));

console.log(`=== Migração Cartões V2 — ${plano.modo} ===`);
console.log('Leitura:', plano.leitura);
console.log('Pagamentos sintéticos a criar:', pagamentosSinteticos.length, brl(pagamentosSinteticos.reduce((a, p) => a + centavos(p.valor), 0)));
console.log('Despesas equivalentes de parcelas órfãs:', despesasDeOrfas.length);
console.log('Compras que recebem cronograma explícito:', comprasComCronograma.length);
console.log('Exclusões:', 0);
console.log('Saldo antigo:', plano.saldo.antigo, '| saldo novo:', plano.saldo.novo, '| equivalente:', equivalente);
console.table(conferenciaFutura);
console.log('Dívida projetada por cartão:', dividaProjetada);
console.log('Plano completo:', arquivo);

if (!equivalente) {
  console.error('ABORTADO: saldo antigo ≠ saldo novo. Nenhuma escrita.');
  process.exit(1);
}
if (!aplicar) {
  console.log('Dry-run: nada foi escrito no Firestore.');
  process.exit(0);
}

// ---- APLICAR (só com --aplicar --confirmo-escrita). Backup antes de escrever.
const backup = path.join(pastaSaida, `backup-comprasCartao-${agora.toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(backup, JSON.stringify(compras.filter((c) => comprasComCronograma.some((x) => x.compraId === c.id)), null, 2));
const operacoes = [
  ...pagamentosSinteticos.map((dados) => (b) => b.set(db.collection('transacoes').doc(), dados)),
  ...despesasDeOrfas.map((dados) => (b) => b.set(db.collection('transacoes').doc(), dados)),
  ...comprasComCronograma.map((x) => (b) => b.update(db.collection('comprasCartao').doc(x.compraId), { parcelas: x.parcelas, parcelasOrigem: MARCA })),
];
for (let i = 0; i < operacoes.length; i += 450) {
  const batch = db.batch();
  operacoes.slice(i, i + 450).forEach((op) => op(batch));
  await batch.commit();
}
console.log(`Aplicado: ${operacoes.length} escritas. Backup: ${backup}. Rode o dry-run de novo para conferir (deve dar 0 escritas e saldo igual).`);
