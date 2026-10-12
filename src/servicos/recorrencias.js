import { collection, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/configuracao';

// Extraído de FormularioRecorrente.jsx (legado) pra ser reaproveitado pelo novo
// RecurrenceFlow — mesma escrita, mesmos campos extras (frequencia/dataInicio/
// ultimoRegistro/ativa) preenchidos só na criação, igual o formulário antigo já fazia.
export async function criarRecorrencia(dados) {
  const dadosCompletos = {
    ...dados,
    frequencia: 'mensal',
    dataInicio: new Date(),
    ultimoRegistro: null,
    ativa: true,
  };
  const docRef = await addDoc(collection(db, 'transacoesRecorrentes'), dadosCompletos);
  return { id: docRef.id, ...dadosCompletos, dataInicio: Timestamp.fromDate(dadosCompletos.dataInicio) };
}

export async function atualizarRecorrencia(id, dados) {
  await updateDoc(doc(db, 'transacoesRecorrentes', id), dados);
  return { id, ...dados };
}
