// I/O de Assinaturas em cartão no Firestore. Regras e decisões ficam em src/dominio/assinaturasCartao.js;
// aqui só: ler → planejar → escrever.
//   - assinatura = `assinaturasCartao` (o template: o que cobra, quando e em qual cartão)
//   - cobrança   = compra à vista em `comprasCartao`, id `${assinaturaId}_${YYYY-MM}` (nunca `transacoes`)
import { collection, doc, addDoc, arrayUnion, getDocs, query, runTransaction, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/configuracao';
import {
  cobrancasFaltantes,
  planejarEdicao,
  planejarCancelamento,
  planejarExclusao,
} from '../dominio/assinaturasCartao.js';
import { primeiraCompetenciaPadrao } from '../dominio/recorrencias.js';

const COLECAO_ASSINATURAS = 'assinaturasCartao';
const COLECAO_COMPRAS = 'comprasCartao';

// Margem abaixo do limite de operações de uma transação/batch do Firestore.
const TAMANHO_DO_LOTE = 150;

const refAssinatura = (id) => doc(db, COLECAO_ASSINATURAS, id);
const refCompra = (id) => doc(db, COLECAO_COMPRAS, id);
const comId = (snapshot) => (snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null);

// Cria só o template; o chamador gera as cobranças em seguida. A primeira competência é dado explícito:
// por padrão, a primeira cobrança a partir de hoje (nada retroativo).
export async function criarAssinatura({ cartaoId, descricao, valor, categoria, diaDoMes, primeiraCompetencia }, agora = new Date()) {
  const dia = Number(diaDoMes);
  const dados = {
    cartaoId,
    descricao,
    valor,
    categoria,
    diaDoMes: dia,
    primeiraCompetencia: primeiraCompetencia ?? primeiraCompetenciaPadrao(dia, agora),
    ativa: true,
    encerradaEm: null,
    competenciasIgnoradas: [],
    criadaEm: agora.toISOString(),
  };
  const ref = await addDoc(collection(db, COLECAO_ASSINATURAS), dados);
  return { id: ref.id, ...dados };
}

// Grava as cobranças que faltam com ID DETERMINÍSTICO, "criar se não existir" numa transação: reabrir o
// app, duas execuções ou duas abas nunca duplicam. Devolve só as que ESTA chamada criou.
export async function garantirCobrancas({ assinaturas, compras, cartoes, agora = new Date() }) {
  const faltantes = cobrancasFaltantes({ assinaturas, compras, cartoes, agora });
  const criadas = [];
  for (let i = 0; i < faltantes.length; i += TAMANHO_DO_LOTE) {
    const lote = faltantes.slice(i, i + TAMANHO_DO_LOTE);
    const gravadas = await runTransaction(db, async (tx) => {
      const snapshots = await Promise.all(lote.map((c) => tx.get(refCompra(c.id))));
      const novas = [];
      lote.forEach((cobranca, indice) => {
        if (snapshots[indice].exists()) return;
        const { id, ...campos } = cobranca;
        tx.set(refCompra(id), campos);
        novas.push(cobranca);
      });
      return novas;
    });
    criadas.push(...gravadas);
  }
  return criadas;
}

async function comprasDaAssinatura(assinaturaId) {
  const snapshot = await getDocs(query(collection(db, COLECAO_COMPRAS), where('assinaturaId', '==', assinaturaId)));
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
}

// Editar afeta só cobranças AINDA NÃO geradas; as compras existentes não são tocadas.
export function editarAssinatura({ assinaturaId, campos }) {
  return runTransaction(db, async (tx) => {
    const assinatura = comId(await tx.get(refAssinatura(assinaturaId)));
    const plano = planejarEdicao({ assinatura, campos });
    if (!plano.ok) return plano;
    tx.update(refAssinatura(assinaturaId), plano.patch);
    return { ok: true, assinatura: { ...assinatura, ...plano.patch } };
  });
}

// Cancelar = parar novas cobranças. ANTES de cancelar, gera o que já era devido (3 meses sem abrir o app
// não podem virar cobranças perdidas). Nada é apagado: compras, faturas e pagamentos ficam.
export async function cancelarAssinatura({ assinaturaId, cartao, agora = new Date() }) {
  const snapshot = await runTransaction(db, async (tx) => comId(await tx.get(refAssinatura(assinaturaId))));
  if (!snapshot) return { ok: false, motivo: 'inexistente' };
  const existentes = await comprasDaAssinatura(assinaturaId);
  const criadas = await garantirCobrancas({ assinaturas: [snapshot], compras: existentes, cartoes: [cartao], agora });
  const resultado = await runTransaction(db, async (tx) => {
    const assinatura = comId(await tx.get(refAssinatura(assinaturaId)));
    const plano = planejarCancelamento({ assinatura, agora });
    if (!plano.ok) return plano;
    tx.update(refAssinatura(assinaturaId), plano.patch);
    return { ok: true, assinatura: { ...assinatura, ...plano.patch } };
  });
  return resultado.ok ? { ...resultado, criadas } : resultado;
}

// Só quando NUNCA gerou cobrança (configuração criada por engano). Com histórico, o caminho é cancelar.
export async function excluirAssinatura({ assinaturaId }) {
  const compras = await comprasDaAssinatura(assinaturaId);
  return runTransaction(db, async (tx) => {
    const assinatura = comId(await tx.get(refAssinatura(assinaturaId)));
    if (!assinatura) return { ok: true };
    const plano = planejarExclusao({ assinatura, compras });
    if (!plano.ok) return plano;
    tx.delete(refAssinatura(assinaturaId));
    return { ok: true };
  });
}

// Remover uma cobrança de assinatura que o usuário não quer: apaga a compra E marca a competência como
// ignorada na assinatura (no mesmo batch) — sem isso a geração a recriaria a cada abertura do app.
export async function excluirCobrancas(compras) {
  const porAssinatura = new Map();
  for (const c of compras) {
    if (!porAssinatura.has(c.assinaturaId)) porAssinatura.set(c.assinaturaId, []);
    porAssinatura.get(c.assinaturaId).push(c.competenciaCobranca);
  }
  const operacoes = [
    ...compras.map((c) => ({ tipo: 'apagar', compra: c })),
    ...[...porAssinatura.entries()].map(([assinaturaId, competencias]) => ({ tipo: 'ignorar', assinaturaId, competencias })),
  ];
  for (let i = 0; i < operacoes.length; i += TAMANHO_DO_LOTE) {
    const batch = writeBatch(db);
    for (const op of operacoes.slice(i, i + TAMANHO_DO_LOTE)) {
      if (op.tipo === 'apagar') batch.delete(refCompra(op.compra.id));
      else batch.update(refAssinatura(op.assinaturaId), { competenciasIgnoradas: arrayUnion(...op.competencias) });
    }
    await batch.commit();
  }
  return porAssinatura;
}

