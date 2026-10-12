import { collection, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/configuracao';

// Mesma convenção monetária do resto do projeto: persistido em reais (decimal),
// não em centavos — igual `transacoes.valor`/`cartoes.limiteTotal`. Centavos só
// existem transitoriamente na UI (entrada via AmountKeypad), convertidos aqui perto
// da escrita, como já acontece em transacoes.js/cartoes.js.
export async function criarMeta(dados) {
  const dadosCompletos = { ...dados, valorReservado: 0 };
  const docRef = await addDoc(collection(db, 'metas'), dadosCompletos);
  return { id: docRef.id, ...dadosCompletos };
}

export async function atualizarMeta(id, dados) {
  await updateDoc(doc(db, 'metas', id), dados);
  return { id, ...dados };
}

// Soma/subtração feita em centavos internamente (evita deriva de ponto flutuante em
// metas com muitos aportes/retiradas ao longo do tempo), persistida de volta em reais.
export async function guardarNaMeta(meta, valorReais) {
  const novoValorReservado = (Math.round(meta.valorReservado * 100) + Math.round(valorReais * 100)) / 100;
  await updateDoc(doc(db, 'metas', meta.id), { valorReservado: novoValorReservado });
  return { ...meta, valorReservado: novoValorReservado };
}

export async function retirarDaMeta(meta, valorReais) {
  const novoValorReservado = (Math.round(meta.valorReservado * 100) - Math.round(valorReais * 100)) / 100;
  await updateDoc(doc(db, 'metas', meta.id), { valorReservado: novoValorReservado });
  return { ...meta, valorReservado: novoValorReservado };
}
