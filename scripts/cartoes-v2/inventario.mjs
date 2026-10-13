// Inventário SOMENTE LEITURA dos dados de cartão antes da migração Cartões V2.
// Uso: node scripts/cartoes-v2/inventario.mjs [caminho-do-relatorio.json]
// Nenhuma escrita: só db.collection(...).get().
import fs from 'node:fs';
import { obterFirestoreAdmin, lerColecao } from './admin.mjs';
import { gerarValoresParcelasLegado, adicionarMesesLegado, janelaLegada, dentroDaJanela, saldoLegado } from './legado.mjs';

const brl = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const centavos = (v) => Math.round(v * 100);

const db = obterFirestoreAdmin();
const [cartoes, compras, transacoes] = await Promise.all([
  lerColecao(db, 'cartoes'),
  lerColecao(db, 'comprasCartao'),
  lerColecao(db, 'transacoes'),
]);

const agora = new Date();
const janela = janelaLegada(agora);
const parcelasLegadas = transacoes.filter((t) => t.origem === 'cartao');
const pagamentosExistentes = transacoes.filter((t) => t.natureza === 'pagamento_fatura');
const caixaPuro = transacoes.filter((t) => t.origem !== 'cartao');
const cartaoPorId = new Map(cartoes.map((c) => [c.id, c]));
const compraPorId = new Map(compras.map((c) => [c.id, c]));

const anomalias = [];

// Transações com forma inesperada (afetariam saldo antigo e novo igualmente, mas é bom saber)
for (const t of transacoes) {
  if (!['receita', 'despesa'].includes(t.tipo)) anomalias.push({ tipo: 'transacao_tipo_desconhecido', id: t.id, valor: t.tipo });
  if (typeof t.valor !== 'number' || Number.isNaN(t.valor)) anomalias.push({ tipo: 'transacao_valor_invalido', id: t.id });
  if (typeof t.data !== 'string') anomalias.push({ tipo: 'transacao_data_nao_string', id: t.id });
}

// Cartões com vencimento no mês seguinte ao fechamento (vencimento derivado antigo errado)
const cartoesVencimentoMesSeguinte = cartoes
  .filter((c) => c.diaVencimento <= c.diaFechamento)
  .map((c) => ({ id: c.id, nome: c.nome, diaFechamento: c.diaFechamento, diaVencimento: c.diaVencimento }));

// Parcelas órfãs / cartão inexistente
for (const p of parcelasLegadas) {
  if (!compraPorId.has(p.compraCartaoId)) anomalias.push({ tipo: 'parcela_orfa', id: p.id, compraCartaoId: p.compraCartaoId, valor: p.valor, competencia: p.competencia });
  if (!cartaoPorId.has(p.cartaoId)) anomalias.push({ tipo: 'parcela_cartao_inexistente', id: p.id, cartaoId: p.cartaoId });
}

// Compra × parcelas gravadas: o cronograma derivado bate com o que existe?
const comprasDivergentes = [];
for (const compra of compras) {
  if (!cartaoPorId.has(compra.cartaoId)) anomalias.push({ tipo: 'compra_cartao_inexistente', id: compra.id, cartaoId: compra.cartaoId });
  const gravadas = parcelasLegadas.filter((p) => p.compraCartaoId === compra.id);
  const derivadas = gerarValoresParcelasLegado(centavos(compra.valorTotal), compra.numeroParcelas).map((v, i) => ({
    competencia: adicionarMesesLegado(compra.primeiraCompetencia, i),
    centavos: v,
  }));

  const somaGravada = gravadas.reduce((a, p) => a + centavos(p.valor), 0);
  const porCompetenciaGravada = {};
  for (const p of gravadas) porCompetenciaGravada[p.competencia] = (porCompetenciaGravada[p.competencia] ?? 0) + centavos(p.valor);
  const porCompetenciaDerivada = Object.fromEntries(derivadas.map((d) => [d.competencia, d.centavos]));

  const competencias = new Set([...Object.keys(porCompetenciaGravada), ...Object.keys(porCompetenciaDerivada)]);
  const diferencas = [...competencias]
    .filter((c) => (porCompetenciaGravada[c] ?? 0) !== (porCompetenciaDerivada[c] ?? 0))
    .map((c) => ({ competencia: c, gravado: porCompetenciaGravada[c] ?? 0, derivado: porCompetenciaDerivada[c] ?? 0 }));

  const textosDiferentes = gravadas.filter((p) => p.descricao !== compra.descricao || p.categoria !== compra.categoria).map((p) => p.id);

  if (diferencas.length || gravadas.length !== compra.numeroParcelas || textosDiferentes.length) {
    comprasDivergentes.push({
      id: compra.id,
      descricao: compra.descricao,
      valorTotal: compra.valorTotal,
      numeroParcelas: compra.numeroParcelas,
      parcelasGravadas: gravadas.length,
      somaGravada,
      diferencasDeValor: diferencas,
      parcelasComDescricaoOuCategoriaDiferente: textosDiferentes,
    });
  }
}

// Parcelas legadas vs. janela antiga (o que já entrou no saldo, o que ainda entraria)
const classe = (p) => (p.data > janela.fimISO ? 'futura' : p.data < janela.inicioISO ? 'anterior_a_janela' : 'na_janela');
const resumoParcelas = { na_janela: { qtd: 0, centavos: 0 }, anterior_a_janela: { qtd: 0, centavos: 0 }, futura: { qtd: 0, centavos: 0 } };
for (const p of parcelasLegadas) {
  const k = classe(p);
  resumoParcelas[k].qtd++;
  resumoParcelas[k].centavos += centavos(p.valor);
}

// Grupos (cartão, competência, data) que receberiam pagamento sintético: data ≤ fim da janela antiga
const grupos = new Map();
for (const p of parcelasLegadas) {
  if (p.data > janela.fimISO) continue;
  const chave = `${p.cartaoId}|${p.competencia}|${p.data}`;
  const g = grupos.get(chave) ?? { cartaoId: p.cartaoId, competencia: p.competencia, data: p.data, centavos: 0, parcelas: 0 };
  g.centavos += centavos(p.valor);
  g.parcelas++;
  grupos.set(chave, g);
}

const saldoAntigo = saldoLegado(transacoes, janela);
const saldoSoCaixa = saldoLegado(caixaPuro, janela);
const parcelasNaJanelaCentavos = parcelasLegadas.filter((p) => dentroDaJanela(p, janela)).reduce((a, p) => a + centavos(p.valor), 0);

const relatorio = {
  geradoEm: agora.toISOString(),
  janelaLegada: janela,
  contagens: {
    cartoes: cartoes.length,
    comprasCartao: compras.length,
    transacoes: transacoes.length,
    parcelasLegadasEmTransacoes: parcelasLegadas.length,
    pagamentosDeFaturaJaExistentes: pagamentosExistentes.length,
    transacoesDeCaixaPuro: caixaPuro.length,
  },
  cartoes: cartoes.map((c) => ({ id: c.id, nome: c.nome, limiteTotal: c.limiteTotal, diaFechamento: c.diaFechamento, diaVencimento: c.diaVencimento })),
  cartoesVencimentoMesSeguinte,
  parcelasLegadasPorJanela: resumoParcelas,
  gruposQueReceberiamPagamentoSintetico: [...grupos.values()],
  comprasDivergentes,
  anomalias,
  saldo: {
    legadoCentavos: saldoAntigo,
    legado: brl(saldoAntigo),
    soCaixaSemParcelasCentavos: saldoSoCaixa,
    parcelasDeCartaoNaJanelaCentavos: parcelasNaJanelaCentavos,
  },
};

console.log('=== Inventário Cartões V2 (somente leitura) ===');
console.log('Janela legada:', janela.inicioISO, '→', janela.fimISO);
console.table(relatorio.contagens);
console.log('Cartões:', relatorio.cartoes);
console.log('Cartões com vencimento ≤ fechamento:', cartoesVencimentoMesSeguinte);
console.log('Parcelas legadas por janela:', Object.fromEntries(Object.entries(resumoParcelas).map(([k, v]) => [k, `${v.qtd} parcelas, ${brl(v.centavos)}`])));
console.log('Grupos (cartão, competência, data) com cobertura sintética:', relatorio.gruposQueReceberiamPagamentoSintetico.length);
console.log('Compras com cronograma divergente:', comprasDivergentes.length);
if (comprasDivergentes.length) console.dir(comprasDivergentes, { depth: 4 });
console.log('Anomalias:', anomalias.length);
if (anomalias.length) console.dir(anomalias, { depth: 3 });
console.log('Saldo legado (fórmula atual do app):', brl(saldoAntigo));
console.log('  = caixa puro', brl(saldoSoCaixa), '− parcelas de cartão na janela', brl(parcelasNaJanelaCentavos));

const destino = process.argv[2];
if (destino) {
  fs.writeFileSync(destino, JSON.stringify(relatorio, null, 2));
  console.log('Relatório completo salvo em', destino);
}
