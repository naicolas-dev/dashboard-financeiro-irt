// I/O de Cartões V2 no Firestore. Regras e cálculos ficam em src/dominio/cartoes.js;
// aqui só leitura/escrita.
//   - compra no cartão = 1 documento em `comprasCartao` (parcelas são derivadas);
//   - pagamento de fatura = 1 documento em `transacoes` (é a saída de caixa real).
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/configuracao';
import {
  NATUREZA_PAGAMENTO_FATURA,
  calcularPrimeiraCompetencia,
  competenciaAberta,
  dataVencimento,
  adicionarMesesCompetencia,
  gerarValoresParcelas,
} from '../dominio/cartoes.js';

export { calcularPrimeiraCompetencia, adicionarMesesCompetencia, gerarValoresParcelas };

// Margem de segurança abaixo do limite de 500 operações por writeBatch do Firestore.
const TAMANHO_MAXIMO_BATCH = 450;

export const OPCOES_PARCELAS = Array.from({ length: 48 }, (_, indice) => indice + 1);

export function rotuloParcelas(numeroParcelas) {
  return numeroParcelas === 1 ? 'À vista' : `${numeroParcelas}x`;
}

function nomeDoMes(data) {
  const nome = data.toLocaleDateString('pt-BR', { month: 'long' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export function nomeCompetencia(competencia) {
  const [ano, mes] = competencia.split('-').map(Number);
  return nomeDoMes(new Date(ano, mes - 1, 1));
}

// Os bancos chamam a fatura pelo mês de VENCIMENTO ("fatura de novembro"); a chave
// interna continua sendo o mês de fechamento (competência).
export function nomeFatura(competencia, cartao) {
  return nomeDoMes(dataVencimento(competencia, cartao));
}

export { competenciaAberta };

export async function criarCartao(dados) {
  const docRef = await addDoc(collection(db, 'cartoes'), dados);
  return { id: docRef.id, ...dados };
}

export async function atualizarCartao(id, dados) {
  await updateDoc(doc(db, 'cartoes', id), dados);
  return { id, ...dados };
}

export async function criarCompraCartao({ cartao, descricao, categoria, valorTotalCentavos, numeroParcelas, dataCompraISO }) {
  const dados = {
    cartaoId: cartao.id,
    descricao,
    categoria,
    valorTotal: valorTotalCentavos / 100,
    numeroParcelas,
    dataCompra: dataCompraISO,
    primeiraCompetencia: calcularPrimeiraCompetencia(new Date(dataCompraISO), cartao.diaFechamento),
  };
  const ref = await addDoc(collection(db, 'comprasCartao'), dados);
  return { id: ref.id, ...dados };
}

// `alterarValor` só é true quando as regras do domínio permitem (nenhuma parcela em
// fatura fechada/paga). `primeiraCompetencia` nunca é recalculada aqui.
export async function atualizarCompraCartao({ compra, descricao, categoria, valorTotalCentavos, numeroParcelas, alterarValor }) {
  const dados = alterarValor
    ? { descricao, categoria, valorTotal: valorTotalCentavos / 100, numeroParcelas }
    : { descricao, categoria };
  await updateDoc(doc(db, 'comprasCartao', compra.id), dados);
  return { ...compra, ...dados };
}

export async function excluirCompraCartao(compraId) {
  await deleteDoc(doc(db, 'comprasCartao', compraId));
}

export async function excluirComprasCartaoEmLote(compraIds) {
  for (let i = 0; i < compraIds.length; i += TAMANHO_MAXIMO_BATCH) {
    const batch = writeBatch(db);
    for (const id of compraIds.slice(i, i + TAMANHO_MAXIMO_BATCH)) batch.delete(doc(db, 'comprasCartao', id));
    await batch.commit();
  }
}

// Todos os pagamentos de fatura, sem a janela de 12 meses do fluxo de caixa — a
// dívida depende do histórico inteiro de pagamentos.
export async function buscarPagamentosDeFatura() {
  const snapshot = await getDocs(query(collection(db, 'transacoes'), where('natureza', '==', NATUREZA_PAGAMENTO_FATURA)));
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function criarPagamentoFatura({ cartao, competencia, valorCentavos, data }) {
  const dados = {
    descricao: `Pagamento da fatura • ${cartao.nome}`,
    valor: valorCentavos / 100,
    tipo: 'despesa',
    categoria: 'Fatura do cartão',
    data,
    natureza: NATUREZA_PAGAMENTO_FATURA,
    cartaoId: cartao.id,
    competencia,
  };
  const ref = await addDoc(collection(db, 'transacoes'), dados);
  return { id: ref.id, ...dados };
}

export async function atualizarPagamentoFatura(pagamento, { valorCentavos, data }) {
  const dados = { valor: valorCentavos / 100, data };
  await updateDoc(doc(db, 'transacoes', pagamento.id), dados);
  return { ...pagamento, ...dados };
}
