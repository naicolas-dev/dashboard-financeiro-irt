// I/O de Recorrentes (obrigações programadas) no Firestore. Regras e decisões ficam em
// src/dominio/recorrencias.js (planejadores puros); aqui só: ler → planejar → escrever, sempre
// dentro de `runTransaction` quando mais de um documento precisa mudar junto.
//   - série        = `transacoesRecorrentes` (o que se repete)
//   - ocorrência   = `ocorrenciasRecorrentes`, id `${serieId}_${YYYY-MM}` (a obrigação de um mês)
//   - liquidação   = `transacoes/liq_<ocorrenciaId>` (única coisa que toca o caixa)
import { collection, doc, addDoc, deleteField, getDocs, query, runTransaction, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/configuracao';
import {
  idLiquidacao,
  ocorrenciasFaltantes,
  primeiraCompetenciaPadrao,
  planejarLiquidacao,
  planejarDesfazerLiquidacao,
  planejarCorrecaoDeLiquidacao,
  planejarAdiamento,
  planejarEdicaoDaOcorrencia,
  planejarCancelamento,
  planejarRestauracao,
  planejarEdicaoDaSerie,
  planejarEncerramento,
  planejarExclusaoDaSerie,
  HORIZONTE_PADRAO_MESES,
} from '../dominio/recorrencias.js';

const COLECAO_SERIES = 'transacoesRecorrentes';
const COLECAO_OCORRENCIAS = 'ocorrenciasRecorrentes';
const COLECAO_TRANSACOES = 'transacoes';

// Margem abaixo do limite de operações de uma transação do Firestore.
const TAMANHO_DO_LOTE = 150;

const refOcorrencia = (id) => doc(db, COLECAO_OCORRENCIAS, id);
const refSerie = (id) => doc(db, COLECAO_SERIES, id);
const refTransacao = (id) => doc(db, COLECAO_TRANSACOES, id);
const comId = (snapshot) => (snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null);

// ---------------------------------------------------------------- séries

// Cria só a série (nenhuma obrigação ainda); o chamador gera as ocorrências em seguida. A primeira
// competência é dado explícito: por padrão, o primeiro vencimento >= hoje (nada retroativo).
export async function criarRecorrencia(dados, agora = new Date()) {
  const diaDoMes = Number(dados.diaDoMes);
  const dadosCompletos = {
    descricao: dados.descricao,
    valor: dados.valor,
    tipo: dados.tipo,
    categoria: dados.categoria,
    diaDoMes,
    frequencia: 'mensal',
    ativa: true,
    dataInicio: agora,
    primeiraCompetencia: dados.primeiraCompetencia ?? primeiraCompetenciaPadrao(diaDoMes, agora),
    totalOcorrencias: dados.totalOcorrencias ?? null,
    encerradaEm: null,
  };
  const docRef = await addDoc(collection(db, COLECAO_SERIES), dadosCompletos);
  return { id: docRef.id, ...dadosCompletos, dataInicio: Timestamp.fromDate(agora) };
}

// ---------------------------------------------------------------- geração (idempotente)

// Grava as ocorrências que faltam com ID DETERMINÍSTICO, "criar se não existir" dentro de uma
// transação: reabrir o app, duas abas ou uma falha no meio nunca duplicam. Devolve só as que ESTA
// chamada criou (as que outra aba criou antes são ignoradas — o próximo load as traz).
export async function garantirOcorrencias({ series, ocorrencias, agora = new Date(), horizonteMeses = HORIZONTE_PADRAO_MESES }) {
  const faltantes = ocorrenciasFaltantes({ series, ocorrencias, agora, horizonteMeses });
  const criadas = [];
  for (let i = 0; i < faltantes.length; i += TAMANHO_DO_LOTE) {
    const lote = faltantes.slice(i, i + TAMANHO_DO_LOTE);
    const gravadas = await runTransaction(db, async (tx) => {
      const snapshots = await Promise.all(lote.map((o) => tx.get(refOcorrencia(o.id))));
      const novas = [];
      lote.forEach((ocorrencia, indice) => {
        if (snapshots[indice].exists()) return;
        const { id, ...campos } = ocorrencia;
        tx.set(refOcorrencia(id), campos);
        novas.push(ocorrencia);
      });
      return novas;
    });
    criadas.push(...gravadas);
  }
  return criadas;
}

// Ids de TODAS as ocorrências da série no banco (não só as que este aparelho carregou), para que
// editar/encerrar/excluir a série nunca deixe uma ocorrência criada por outra aba para trás.
async function idsDasOcorrenciasDaSerie(serieId) {
  const snapshot = await getDocs(query(collection(db, COLECAO_OCORRENCIAS), where('serieId', '==', serieId)));
  return snapshot.docs.map((d) => d.id);
}

async function lerOcorrencias(tx, ids) {
  const snapshots = await Promise.all(ids.map((id) => tx.get(refOcorrencia(id))));
  return snapshots.map(comId).filter(Boolean);
}

function validarCamposDaSerie(campos) {
  const limpos = {};
  if (campos.descricao !== undefined) {
    const texto = String(campos.descricao).trim();
    if (!texto) return { ok: false, motivo: 'descricao_invalida' };
    limpos.descricao = texto;
  }
  if (campos.valor !== undefined) {
    const valor = Math.round(Number(campos.valor) * 100) / 100;
    if (!(valor > 0)) return { ok: false, motivo: 'valor_invalido' };
    limpos.valor = valor;
  }
  if (campos.diaDoMes !== undefined) {
    const dia = Number(campos.diaDoMes);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return { ok: false, motivo: 'dia_invalido' };
    limpos.diaDoMes = dia;
  }
  if (campos.tipo !== undefined) {
    if (campos.tipo !== 'receita' && campos.tipo !== 'despesa') return { ok: false, motivo: 'tipo_invalido' };
    limpos.tipo = campos.tipo;
  }
  if (campos.categoria !== undefined) limpos.categoria = campos.categoria;
  return { ok: true, limpos };
}

// Editar a série: histórico realizado, atrasadas e campos sobrescritos NÃO mudam; pendentes futuras
// recebem a nova configuração. Tudo (série + ocorrências) numa transação, relendo o banco.
export async function editarSerie({ serieId, campos, agora = new Date() }) {
  const validacao = validarCamposDaSerie(campos);
  if (!validacao.ok) return validacao;
  const ids = await idsDasOcorrenciasDaSerie(serieId);
  return runTransaction(db, async (tx) => {
    const snapshotSerie = await tx.get(refSerie(serieId));
    const ocorrencias = await lerOcorrencias(tx, ids);
    const serieAntiga = comId(snapshotSerie);
    if (!serieAntiga) return { ok: false, motivo: 'inexistente' };
    const serieNova = { ...serieAntiga, ...validacao.limpos };
    const plano = planejarEdicaoDaSerie({ serieAntiga, serieNova, ocorrencias, agora });
    tx.update(refSerie(serieId), validacao.limpos);
    for (const { id, campos: patch } of plano.patches) tx.update(refOcorrencia(id), patch);
    return { ok: true, serie: serieNova, patches: plano.patches, contagem: plano.contagem };
  });
}

// Encerrar "daqui para frente": cancela só as pendentes ainda não vencidas; atrasadas e realizadas
// permanecem; a série deixa de gerar.
export async function encerrarSerie({ serieId, agora = new Date() }) {
  const ids = await idsDasOcorrenciasDaSerie(serieId);
  return runTransaction(db, async (tx) => {
    const snapshotSerie = await tx.get(refSerie(serieId));
    const ocorrencias = await lerOcorrencias(tx, ids);
    const serie = comId(snapshotSerie);
    if (!serie) return { ok: false, motivo: 'inexistente' };
    const plano = planejarEncerramento({ serie, ocorrencias, agora });
    tx.update(refSerie(serieId), plano.serieCampos);
    for (const id of plano.cancelarIds) tx.update(refOcorrencia(id), { status: 'cancelada' });
    return { ok: true, serie: { ...serie, ...plano.serieCampos }, cancelarIds: plano.cancelarIds, preservadas: plano.preservadas };
  });
}

// Só quando NUNCA houve liquidação (série criada por engano). Com histórico, o caminho é encerrar.
export async function excluirSerie({ serieId }) {
  const ids = await idsDasOcorrenciasDaSerie(serieId);
  return runTransaction(db, async (tx) => {
    const snapshotSerie = await tx.get(refSerie(serieId));
    const ocorrencias = await lerOcorrencias(tx, ids);
    const serie = comId(snapshotSerie);
    if (!serie) return { ok: true, apagarOcorrenciaIds: ids };
    const plano = planejarExclusaoDaSerie({ serie, ocorrencias });
    if (!plano.ok) return plano;
    for (const id of plano.apagarOcorrenciaIds) tx.delete(refOcorrencia(id));
    tx.delete(refSerie(serieId));
    return plano;
  });
}

// ---------------------------------------------------------------- liquidação (pagar / receber)

// Cria a transação de liquidação E marca a ocorrência como realizada, atomicamente. Duas abas ou
// cliques repetidos: o segundo vê `realizada` e não faz nada.
export function liquidarOcorrencia({ ocorrenciaId, valor, data }) {
  return runTransaction(db, async (tx) => {
    const [snapshotOcorrencia, snapshotTransacao] = await Promise.all([tx.get(refOcorrencia(ocorrenciaId)), tx.get(refTransacao(idLiquidacao(ocorrenciaId)))]);
    const ocorrencia = comId(snapshotOcorrencia);
    const transacaoExistente = comId(snapshotTransacao);
    const plano = planejarLiquidacao({ ocorrencia, valor, data, transacaoExistente });
    if (!plano.ok) return plano;
    if (plano.transacao) tx.set(refTransacao(plano.transacaoId), plano.transacao);
    tx.update(refOcorrencia(ocorrenciaId), plano.ocorrenciaPatch);
    return {
      ...plano,
      ocorrencia: { ...ocorrencia, ...plano.ocorrenciaPatch },
      transacao: plano.transacao ? { ...plano.transacao, id: plano.transacaoId } : transacaoExistente,
    };
  });
}

// Desfazer: apaga a transação e devolve a ocorrência a pendente na MESMA transação do banco — nunca
// sobra "realizada sem transação" nem "transação com ocorrência pendente". Se o banco já estava
// inconsistente, reconcilia e devolve `reconciliada: true` para a UI avisar.
export function desfazerLiquidacao({ ocorrenciaId }) {
  return runTransaction(db, async (tx) => {
    const [snapshotOcorrencia, snapshotTransacao] = await Promise.all([tx.get(refOcorrencia(ocorrenciaId)), tx.get(refTransacao(idLiquidacao(ocorrenciaId)))]);
    const ocorrencia = comId(snapshotOcorrencia);
    const plano = planejarDesfazerLiquidacao({ ocorrencia, transacaoExiste: snapshotTransacao.exists() });
    if (!plano.ok || plano.nada) return plano;
    if (plano.apagarTransacaoId) tx.delete(refTransacao(plano.apagarTransacaoId));
    const campos = { ...plano.ocorrenciaPatch };
    for (const campo of plano.removerCampos) campos[campo] = deleteField();
    tx.update(refOcorrencia(ocorrenciaId), campos);
    const { transacaoId: _removido, ...semVinculo } = ocorrencia;
    return { ...plano, ocorrencia: { ...semVinculo, ...plano.ocorrenciaPatch } };
  });
}

// Corrigir valor/data do que foi pago/recebido (a obrigação em si não muda).
export function corrigirLiquidacao({ ocorrenciaId, valor, data }) {
  return runTransaction(db, async (tx) => {
    const [snapshotOcorrencia, snapshotTransacao] = await Promise.all([tx.get(refOcorrencia(ocorrenciaId)), tx.get(refTransacao(idLiquidacao(ocorrenciaId)))]);
    const ocorrencia = comId(snapshotOcorrencia);
    const transacao = comId(snapshotTransacao);
    const plano = planejarCorrecaoDeLiquidacao({ ocorrencia, transacaoExiste: Boolean(transacao), valor, data });
    if (!plano.ok) return plano;
    tx.update(refTransacao(plano.transacaoId), plano.transacaoPatch);
    return { ...plano, ocorrencia, transacao: { ...transacao, ...plano.transacaoPatch } };
  });
}

// ---------------------------------------------------------------- ações sobre uma ocorrência

// lê → planeja (puro) → aplica o patch, tudo na mesma transação.
function alterarOcorrencia(ocorrenciaId, planejar) {
  return runTransaction(db, async (tx) => {
    const ocorrencia = comId(await tx.get(refOcorrencia(ocorrenciaId)));
    const plano = planejar(ocorrencia);
    if (!plano.ok) return plano;
    tx.update(refOcorrencia(ocorrenciaId), plano.patch);
    return { ...plano, ocorrencia: { ...ocorrencia, ...plano.patch } };
  });
}

export const adiarOcorrencia = ({ ocorrenciaId, novoVencimento }) => alterarOcorrencia(ocorrenciaId, (ocorrencia) => planejarAdiamento({ ocorrencia, novoVencimento }));
export const editarOcorrencia = ({ ocorrenciaId, campos }) => alterarOcorrencia(ocorrenciaId, (ocorrencia) => planejarEdicaoDaOcorrencia({ ocorrencia, campos }));
export const cancelarOcorrencia = ({ ocorrenciaId }) => alterarOcorrencia(ocorrenciaId, (ocorrencia) => planejarCancelamento({ ocorrencia }));
export const restaurarOcorrencia = ({ ocorrenciaId }) => alterarOcorrencia(ocorrenciaId, (ocorrencia) => planejarRestauracao({ ocorrencia }));
