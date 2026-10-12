import { collection, doc, addDoc, updateDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/configuracao';

// Margem de segurança abaixo do limite de 500 operações por writeBatch do Firestore.
const TAMANHO_MAXIMO_BATCH = 450;

export const OPCOES_PARCELAS = Array.from({ length: 48 }, (_, indice) => indice + 1);

export function rotuloParcelas(numeroParcelas) {
  return numeroParcelas === 1 ? 'À vista' : `${numeroParcelas}x`;
}

// Divide em centavos inteiros — nunca em ponto flutuante — e joga o resto da divisão
// nas primeiras parcelas. Ex.: R$100,00/3 → [3334, 3333, 3333], soma exata = 10000.
export function gerarValoresParcelas(valorTotalCentavos, numeroParcelas) {
  const base = Math.floor(valorTotalCentavos / numeroParcelas);
  const resto = valorTotalCentavos - base * numeroParcelas;
  return Array.from({ length: numeroParcelas }, (_, indice) => (indice < resto ? base + 1 : base));
}

function formatarCompetencia(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

function ultimoDiaDoMes(ano, mesIndex) {
  return new Date(ano, mesIndex + 1, 0).getDate();
}

export function competenciaAtual() {
  return formatarCompetencia(new Date());
}

// Compra no dia do fechamento ou depois cai na fatura do mês seguinte — a fatura do
// mês corrente já fechou pra novas compras.
export function calcularPrimeiraCompetencia(dataCompraISO, diaFechamento) {
  const dataCompra = new Date(dataCompraISO);
  const ano = dataCompra.getFullYear();
  const mes = dataCompra.getMonth();
  const dia = dataCompra.getDate();
  const base = dia >= diaFechamento ? new Date(ano, mes + 1, 1) : new Date(ano, mes, 1);
  return formatarCompetencia(base);
}

export function adicionarMesesCompetencia(competencia, quantidadeMeses) {
  const [ano, mes] = competencia.split('-').map(Number);
  return formatarCompetencia(new Date(ano, mes - 1 + quantidadeMeses, 1));
}

// Dia de vencimento clampado ao último dia do mês da competência — evita rollover do
// JS Date pra um "31" num mês com menos dias (ex.: fevereiro).
export function dataDaParcela(competencia, diaVencimento) {
  const [ano, mes] = competencia.split('-').map(Number);
  const mesIndex = mes - 1;
  const dia = Math.min(diaVencimento, ultimoDiaDoMes(ano, mesIndex));
  return new Date(ano, mesIndex, dia).toISOString();
}

export function nomeCompetencia(competencia) {
  const [ano, mes] = competencia.split('-').map(Number);
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export async function criarCartao(dados) {
  const docRef = await addDoc(collection(db, 'cartoes'), dados);
  return { id: docRef.id, ...dados };
}

export async function atualizarCartao(id, dados) {
  await updateDoc(doc(db, 'cartoes', id), dados);
  return { id, ...dados };
}

// writeBatch: 1 doc em comprasCartao + N docs em transacoes (refs pré-gerados via
// doc(collection(...)) pra poder referenciar compraRef.id em cada parcela antes do
// commit) — até 48 parcelas + 1 compra = 49 writes, bem dentro do limite de 500/batch.
export async function criarCompraCartao({ cartao, descricao, categoria, valorTotalCentavos, numeroParcelas, dataCompraISO }) {
  const batch = writeBatch(db);
  const compraRef = doc(collection(db, 'comprasCartao'));
  const primeiraCompetencia = calcularPrimeiraCompetencia(dataCompraISO, cartao.diaFechamento);
  const valorTotal = valorTotalCentavos / 100;

  const dadosCompra = {
    cartaoId: cartao.id,
    descricao,
    categoria,
    valorTotal,
    numeroParcelas,
    dataCompra: dataCompraISO,
    primeiraCompetencia,
  };
  batch.set(compraRef, dadosCompra);

  const valoresParcelas = gerarValoresParcelas(valorTotalCentavos, numeroParcelas);
  const parcelas = valoresParcelas.map((centavos, indice) => {
    const competencia = adicionarMesesCompetencia(primeiraCompetencia, indice);
    const parcelaRef = doc(collection(db, 'transacoes'));
    const dadosParcela = {
      descricao,
      valor: centavos / 100,
      tipo: 'despesa',
      categoria,
      data: dataDaParcela(competencia, cartao.diaVencimento),
      origem: 'cartao',
      cartaoId: cartao.id,
      compraCartaoId: compraRef.id,
      parcelaAtual: indice + 1,
      totalParcelas: numeroParcelas,
      valorTotalCompra: valorTotal,
      competencia,
    };
    batch.set(parcelaRef, dadosParcela);
    return { id: parcelaRef.id, ...dadosParcela };
  });

  await batch.commit();
  return { compra: { id: compraRef.id, ...dadosCompra }, parcelas };
}

// `reestruturar=false`: só descrição/categoria mudaram — atualiza a compra e repete
// os mesmos campos em cada parcela existente (valor/parcelamento/competência intocados).
// `reestruturar=true`: valor total e/ou número de parcelas mudaram — apaga as parcelas
// existentes e recria do zero a partir de `compra.primeiraCompetencia` (nunca
// recalculada aqui, fica protegida mesmo que o cartão tenha mudado de dia de
// fechamento depois que a compra foi criada). Um writeBatch só, nos dois casos —
// mesma garantia de atomicidade do `criarCompraCartao`, nunca vários updateDoc soltos.
export async function atualizarCompraCartao({
  compra,
  cartao,
  descricao,
  categoria,
  valorTotalCentavos,
  numeroParcelas,
  parcelasExistentes,
  reestruturar,
}) {
  const batch = writeBatch(db);
  const compraRef = doc(db, 'comprasCartao', compra.id);

  if (!reestruturar) {
    batch.update(compraRef, { descricao, categoria });
    for (const parcela of parcelasExistentes) {
      batch.update(doc(db, 'transacoes', parcela.id), { descricao, categoria });
    }
    await batch.commit();
    return {
      compra: { ...compra, descricao, categoria },
      parcelasAtualizadas: parcelasExistentes.map((p) => ({ ...p, descricao, categoria })),
    };
  }

  const valorTotal = valorTotalCentavos / 100;
  batch.update(compraRef, { descricao, categoria, valorTotal, numeroParcelas });
  for (const parcela of parcelasExistentes) {
    batch.delete(doc(db, 'transacoes', parcela.id));
  }

  const valoresParcelas = gerarValoresParcelas(valorTotalCentavos, numeroParcelas);
  const parcelasNovas = valoresParcelas.map((centavos, indice) => {
    const competencia = adicionarMesesCompetencia(compra.primeiraCompetencia, indice);
    const parcelaRef = doc(collection(db, 'transacoes'));
    const dadosParcela = {
      descricao,
      valor: centavos / 100,
      tipo: 'despesa',
      categoria,
      data: dataDaParcela(competencia, cartao.diaVencimento),
      origem: 'cartao',
      cartaoId: cartao.id,
      compraCartaoId: compra.id,
      parcelaAtual: indice + 1,
      totalParcelas: numeroParcelas,
      valorTotalCompra: valorTotal,
      competencia,
    };
    batch.set(parcelaRef, dadosParcela);
    return { id: parcelaRef.id, ...dadosParcela };
  });

  await batch.commit();
  return {
    compra: { ...compra, descricao, categoria, valorTotal, numeroParcelas },
    parcelasRemovidasIds: parcelasExistentes.map((p) => p.id),
    parcelasNovas,
  };
}

export async function excluirCompraComParcelas(compraId, parcelaIds) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'comprasCartao', compraId));
  for (const id of parcelaIds) {
    batch.delete(doc(db, 'transacoes', id));
  }
  await batch.commit();
}

// Mesma ideia, dividida em grupos de até `TAMANHO_MAXIMO_BATCH` operações — útil pra
// limpar várias compras de uma vez sem esbarrar no limite de 500 escritas por batch.
export async function excluirComprasComParcelasEmLote(compraIds, parcelaIds) {
  const operacoes = [
    ...compraIds.map((id) => ({ colecao: 'comprasCartao', id })),
    ...parcelaIds.map((id) => ({ colecao: 'transacoes', id })),
  ];

  for (let i = 0; i < operacoes.length; i += TAMANHO_MAXIMO_BATCH) {
    const grupo = operacoes.slice(i, i + TAMANHO_MAXIMO_BATCH);
    const batch = writeBatch(db);
    for (const operacao of grupo) {
      batch.delete(doc(db, operacao.colecao, operacao.id));
    }
    await batch.commit();
  }
}

// Todas as parcelas de cartão, de todos os cartões, sem recorte de data — a janela de
// 12 meses do useDadosFinanceiros é só pro fluxo de caixa (Home/Movimentações); fatura
// e extrato de cartão nunca podem ficar sem parcelas futuras/antigas por causa dela.
export async function buscarParcelasDeCartao() {
  const q = query(collection(db, 'transacoes'), where('origem', '==', 'cartao'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
}
