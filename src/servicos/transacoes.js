import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/configuracao';

// Extraído de FormularioTransacao.jsx pra ser reaproveitado também pelo novo
// TransactionFlow — mesma escrita, mesmo payload, sem duplicar a lógica de persistência.
export async function criarTransacao(dados) {
  const docRef = await addDoc(collection(db, 'transacoes'), dados);
  return { id: docRef.id, ...dados };
}

export async function atualizarTransacao(id, dados) {
  await updateDoc(doc(db, 'transacoes', id), dados);
  return { id, ...dados };
}
