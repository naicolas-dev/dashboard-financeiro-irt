// Domínio puro de Recorrentes como OBRIGAÇÃO PROGRAMADA (série × ocorrência).
//
//   série       = o que se repete (transacoesRecorrentes)
//   ocorrência  = a obrigação concreta de UM período (ocorrenciasRecorrentes, id = serieId_YYYY-MM)
//   liquidação  = a transação real que quita a ocorrência (única coisa que toca o caixa)
//
// Neutro quanto a receita/despesa: estado persistido `pendente | realizada | cancelada` e
// natureza `liquidacao_recorrente`; a UI traduz por `tipo` (Pagar/Paga × Receber/Recebida).
// `atrasada`, `venceHoje` e `proxima` são DERIVADOS do relógio (nunca persistidos); adiar não é
// estado, é `vencimento ≠ vencimentoOriginal` com a ocorrência ainda pendente.
//
// Sem Firebase, sem React, `agora` sempre injetado. Valores em REAIS nos documentos (convenção do
// app); toda data passa por tempo.js. Os "planejadores" devolvem o que escrever — os serviços só
// executam dentro de transações do Firestore.
import {
  paraTimestamp,
  mesLocal,
  inicioDoDiaLocal,
  fimDoDiaLocal,
  somarMesesCompetencia,
  dataNoMes,
  paraDataISO,
  ehDataValida,
  ehCompetenciaValida,
} from './tempo.js';

export const STATUS_PENDENTE = 'pendente';
export const STATUS_REALIZADA = 'realizada';
export const STATUS_CANCELADA = 'cancelada';
export const NATUREZA_LIQUIDACAO_RECORRENTE = 'liquidacao_recorrente';
export const HORIZONTE_PADRAO_MESES = 2;
const LIMITE_DE_SEGURANCA_COMPETENCIAS = 1200; // 100 anos: só evita laço infinito em dado corrompido

export const idOcorrencia = (serieId, competencia) => `${serieId}_${competencia}`;
export const idLiquidacao = (ocorrenciaId) => `liq_${ocorrenciaId}`;

export const ehLiquidacaoRecorrente = (transacao) => transacao?.natureza === NATUREZA_LIQUIDACAO_RECORRENTE;

// A UI traduz a direção; o domínio não fala em "pagar".
export function rotulosPorTipo(tipo) {
  return tipo === 'receita'
    ? { grupo: 'A receber', acao: 'Receber', estado: 'Recebida', desfazer: 'Desfazer recebimento', verbo: 'recebimento' }
    : { grupo: 'A pagar', acao: 'Pagar', estado: 'Paga', desfazer: 'Desfazer pagamento', verbo: 'pagamento' };
}

const reais = (v) => Math.round(Number(v) * 100) / 100;

// ---------------------------------------------------------------- série

// Primeiro vencimento >= hoje: se o dia do mês já passou, começa no mês seguinte (acaba o
// retroativo imediato). É só o DEFAULT — `primeiraCompetencia` é dado explícito da série e pode
// ser anterior (série já em andamento) quando a UI permitir.
export function primeiraCompetenciaPadrao(diaDoMes, agora) {
  const mesAtual = mesLocal(agora);
  const venceNesteMes = paraTimestamp(dataNoMes(mesAtual, diaDoMes)) >= inicioDoDiaLocal(agora);
  return venceNesteMes ? mesAtual : somarMesesCompetencia(mesAtual, 1);
}

// Séries legadas (sem os campos novos) são lidas como séries novas — sem migração. A primeira
// competência vem de `ultimoRegistro` (já gerou aquele mês no modelo antigo) ou de `dataInicio`.
export function normalizarSerie(doc) {
  const dataInicio = paraTimestamp(doc.dataInicio);
  const ultimo = paraTimestamp(doc.ultimoRegistro);
  let primeira = doc.primeiraCompetencia;
  if (!ehCompetenciaValida(primeira)) {
    if (Number.isFinite(ultimo)) primeira = somarMesesCompetencia(mesLocal(ultimo), 1);
    else if (Number.isFinite(dataInicio)) primeira = mesLocal(dataInicio);
    else primeira = primeiraCompetenciaPadrao(doc.diaDoMes ?? 1, new Date());
  }
  return {
    ...doc,
    valor: Number(doc.valor),
    diaDoMes: Number(doc.diaDoMes),
    frequencia: doc.frequencia ?? 'mensal',
    ativa: doc.ativa !== false,
    primeiraCompetencia: primeira,
    totalOcorrencias: Number.isFinite(Number(doc.totalOcorrencias)) && doc.totalOcorrencias !== null ? Number(doc.totalOcorrencias) : null,
    encerradaEm: ehCompetenciaValida(doc.encerradaEm) ? doc.encerradaEm : null,
  };
}

// Competências em que a série deve ter ocorrência, de `primeiraCompetencia` até `ate` (inclusive),
// respeitando o fim da série. `totalOcorrencias` conta COMPETÊNCIAS a partir da primeira (cancelar
// uma ocorrência não estende o plano de N parcelas).
export function competenciasEsperadas(serieBruta, ate) {
  const serie = normalizarSerie(serieBruta);
  if (!serie.ativa) return [];
  let fim = ate;
  if (serie.totalOcorrencias !== null && serie.totalOcorrencias >= 0) {
    const ultimaDoPlano = somarMesesCompetencia(serie.primeiraCompetencia, serie.totalOcorrencias - 1);
    if (ultimaDoPlano < fim) fim = ultimaDoPlano;
  }
  if (serie.encerradaEm) {
    const ultimaAntesDoFim = somarMesesCompetencia(serie.encerradaEm, -1);
    if (ultimaAntesDoFim < fim) fim = ultimaAntesDoFim;
  }
  const lista = [];
  for (let c = serie.primeiraCompetencia, i = 0; c <= fim && i < LIMITE_DE_SEGURANCA_COMPETENCIAS; c = somarMesesCompetencia(c, 1), i++) lista.push(c);
  return lista;
}

export function novaOcorrencia(serie, competencia, agora) {
  const vencimento = dataNoMes(competencia, serie.diaDoMes);
  return {
    id: idOcorrencia(serie.id, competencia),
    serieId: serie.id,
    competencia,
    tipo: serie.tipo,
    descricao: serie.descricao,
    categoria: serie.categoria,
    valor: reais(serie.valor),
    vencimentoOriginal: vencimento,
    vencimento,
    status: STATUS_PENDENTE,
    sobrescritos: [],
    criadaEm: new Date(paraTimestamp(agora)).toISOString(),
  };
}

// Pura: o que falta criar. "Existe" = qualquer status (uma CANCELADA nunca é recriada) e a chave é
// o id determinístico serieId_competência, então reabrir o app, relógio alterado ou duas abas
// produzem sempre o mesmo conjunto. Recupera TODAS as competências perdidas desde o início.
export function ocorrenciasFaltantes({ series, ocorrencias, agora, horizonteMeses = HORIZONTE_PADRAO_MESES }) {
  const existentes = new Set(ocorrencias.map((o) => o.id));
  const ate = somarMesesCompetencia(mesLocal(agora), horizonteMeses);
  const faltantes = [];
  for (const bruta of series) {
    const serie = normalizarSerie(bruta);
    for (const competencia of competenciasEsperadas(serie, ate)) {
      if (!existentes.has(idOcorrencia(serie.id, competencia))) faltantes.push(novaOcorrencia(serie, competencia, agora));
    }
  }
  return faltantes;
}

// ---------------------------------------------------------------- estados derivados

// 'realizada' | 'cancelada' | 'atrasada' | 'venceHoje' | 'proxima'. Atraso só depois do FIM do dia
// local do vencimento: uma obrigação que vence hoje não está atrasada durante o próprio dia.
export function statusEfetivo(ocorrencia, agora) {
  if (ocorrencia.status === STATUS_REALIZADA) return 'realizada';
  if (ocorrencia.status === STATUS_CANCELADA) return 'cancelada';
  const instante = paraTimestamp(agora);
  const fim = fimDoDiaLocal(ocorrencia.vencimento);
  const inicio = inicioDoDiaLocal(ocorrencia.vencimento);
  if (!Number.isFinite(fim)) return 'proxima';
  if (fim < instante) return 'atrasada';
  if (inicio <= instante) return 'venceHoje';
  return 'proxima';
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;
export function diasDeAtraso(ocorrencia, agora) {
  if (statusEfetivo(ocorrencia, agora) !== 'atrasada') return 0;
  return Math.round((inicioDoDiaLocal(agora) - inicioDoDiaLocal(ocorrencia.vencimento)) / UM_DIA_MS);
}

export function diasParaVencer(ocorrencia, agora) {
  return Math.round((inicioDoDiaLocal(ocorrencia.vencimento) - inicioDoDiaLocal(agora)) / UM_DIA_MS);
}

const porVencimento = (a, b) => paraTimestamp(a.vencimento) - paraTimestamp(b.vencimento) || (a.id < b.id ? -1 : 1);

// Grupos da aba Programadas. `liquidacoesPorId`: transacoes de liquidação indexadas por id (a
// verdade sobre QUANDO foi quitada vem da transação, não de uma cópia na ocorrência).
export function agruparObrigacoes(ocorrencias, agora, { liquidacoesPorId = {}, diasRecentes = 30 } = {}) {
  const grupos = { atrasadas: [], venceHoje: [], proximas: [], realizadasRecentes: [], canceladas: [] };
  const limiteRecente = paraTimestamp(agora) - diasRecentes * UM_DIA_MS;
  for (const o of ocorrencias) {
    const efetivo = statusEfetivo(o, agora);
    if (efetivo === 'atrasada') grupos.atrasadas.push(o);
    else if (efetivo === 'venceHoje') grupos.venceHoje.push(o);
    else if (efetivo === 'proxima') grupos.proximas.push(o);
    else if (efetivo === 'cancelada') grupos.canceladas.push(o);
    else {
      const quando = paraTimestamp(liquidacoesPorId[o.transacaoId]?.data ?? o.vencimento);
      if (Number.isFinite(quando) && quando >= limiteRecente) grupos.realizadasRecentes.push({ ...o, _quando: quando });
    }
  }
  grupos.atrasadas.sort(porVencimento);
  grupos.venceHoje.sort(porVencimento);
  grupos.proximas.sort(porVencimento);
  grupos.canceladas.sort((a, b) => (a.competencia < b.competencia ? 1 : -1));
  grupos.realizadasRecentes.sort((a, b) => b._quando - a._quando);
  return grupos;
}

// "A pagar" / "A receber": soma (em centavos) das obrigações PENDENTES. É informação, nunca saldo.
export function totaisPendentes(ocorrencias) {
  const totais = { aPagarCentavos: 0, aReceberCentavos: 0 };
  for (const o of ocorrencias) {
    if (o.status !== STATUS_PENDENTE) continue;
    const centavos = Math.round(Number(o.valor) * 100);
    if (o.tipo === 'receita') totais.aReceberCentavos += centavos;
    else totais.aPagarCentavos += centavos;
  }
  return totais;
}

// ---------------------------------------------------------------- liquidação (pagar/receber)

// Valor e data REAIS da liquidação (podem diferir do vencimento: venceu 10/10, pago 13/10 ⇒ a saída
// entra no caixa em 13/10). Id da transação determinístico ⇒ duas abas/cliques nunca geram duas.
export function planejarLiquidacao({ ocorrencia, valor, data, transacaoExistente = null }) {
  if (!ocorrencia) return { ok: false, motivo: 'inexistente' };
  if (ocorrencia.status === STATUS_CANCELADA) return { ok: false, motivo: 'cancelada' };
  if (ocorrencia.status === STATUS_REALIZADA) return { ok: false, motivo: 'ja_realizada' };
  const valorFinal = reais(valor);
  if (!(valorFinal > 0)) return { ok: false, motivo: 'valor_invalido' };
  if (!ehDataValida(data)) return { ok: false, motivo: 'data_invalida' };

  const transacaoId = idLiquidacao(ocorrencia.id);
  const patch = { status: STATUS_REALIZADA, transacaoId };

  // Estado inconsistente herdado (liquidação existe, ocorrência ainda pendente): vincula em vez de duplicar.
  if (transacaoExistente) return { ok: true, reconciliada: true, transacaoId, transacao: null, ocorrenciaPatch: patch };

  return {
    ok: true,
    reconciliada: false,
    transacaoId,
    transacao: {
      descricao: ocorrencia.descricao,
      valor: valorFinal,
      tipo: ocorrencia.tipo,
      categoria: ocorrencia.categoria,
      data,
      natureza: NATUREZA_LIQUIDACAO_RECORRENTE,
      serieId: ocorrencia.serieId,
      ocorrenciaId: ocorrencia.id,
      competencia: ocorrencia.competencia,
    },
    ocorrenciaPatch: patch,
  };
}

// Desfazer: apaga a transação vinculada (se existir) e devolve a ocorrência a pendente, na MESMA
// transação do banco. Se a transação já não existe (dado inconsistente), reconcilia e avisa.
export function planejarDesfazerLiquidacao({ ocorrencia, transacaoExiste }) {
  if (!ocorrencia) return { ok: false, motivo: 'inexistente' };
  if (ocorrencia.status === STATUS_CANCELADA) return { ok: false, motivo: 'cancelada' };
  const realizada = ocorrencia.status === STATUS_REALIZADA;
  if (!realizada && !transacaoExiste) return { ok: true, nada: true, reconciliada: false };
  return {
    ok: true,
    nada: false,
    apagarTransacaoId: transacaoExiste ? idLiquidacao(ocorrencia.id) : null,
    ocorrenciaPatch: { status: STATUS_PENDENTE },
    removerCampos: ['transacaoId'],
    // realizada sem transação, ou transação sem ocorrência realizada
    reconciliada: realizada ? !transacaoExiste : true,
  };
}

// Correção do VALOR/DATA da liquidação (não da obrigação).
export function planejarCorrecaoDeLiquidacao({ ocorrencia, transacaoExiste, valor, data }) {
  if (!ocorrencia || ocorrencia.status !== STATUS_REALIZADA) return { ok: false, motivo: 'nao_realizada' };
  if (!transacaoExiste) return { ok: false, motivo: 'sem_transacao' };
  const valorFinal = reais(valor);
  if (!(valorFinal > 0)) return { ok: false, motivo: 'valor_invalido' };
  if (!ehDataValida(data)) return { ok: false, motivo: 'data_invalida' };
  return { ok: true, transacaoId: idLiquidacao(ocorrencia.id), transacaoPatch: { valor: valorFinal, data } };
}

// ---------------------------------------------------------------- ações sobre UMA ocorrência

const somenteSePendente = (ocorrencia) => {
  if (!ocorrencia) return { ok: false, motivo: 'inexistente' };
  if (ocorrencia.status === STATUS_REALIZADA) return { ok: false, motivo: 'realizada_desfazer_antes' };
  if (ocorrencia.status === STATUS_CANCELADA) return { ok: false, motivo: 'cancelada' };
  return null;
};

function patchDeVencimento(ocorrencia, novoVencimento) {
  const novo = paraDataISO(novoVencimento);
  if (!novo) return { ok: false, motivo: 'data_invalida' };
  const sobrescritos = new Set(ocorrencia.sobrescritos ?? []);
  // Voltar ao calendário da série deixa de ser exceção.
  if (novo === ocorrencia.vencimentoOriginal) sobrescritos.delete('vencimento');
  else sobrescritos.add('vencimento');
  return { ok: true, patch: { vencimento: novo, sobrescritos: [...sobrescritos] } };
}

// Adiar muda SÓ esta ocorrência; a série e as outras seguem o calendário; o original fica guardado.
export function planejarAdiamento({ ocorrencia, novoVencimento }) {
  return somenteSePendente(ocorrencia) ?? patchDeVencimento(ocorrencia, novoVencimento);
}

export function planejarEdicaoDaOcorrencia({ ocorrencia, campos }) {
  const bloqueio = somenteSePendente(ocorrencia);
  if (bloqueio) return bloqueio;
  const patch = {};
  const sobrescritos = new Set(ocorrencia.sobrescritos ?? []);

  if (campos.valor !== undefined) {
    const v = reais(campos.valor);
    if (!(v > 0)) return { ok: false, motivo: 'valor_invalido' };
    if (v !== ocorrencia.valor) {
      patch.valor = v;
      sobrescritos.add('valor');
    }
  }
  for (const campo of ['descricao', 'categoria']) {
    if (campos[campo] === undefined) continue;
    const texto = String(campos[campo]).trim();
    if (!texto) return { ok: false, motivo: `${campo}_invalida` };
    if (texto !== ocorrencia[campo]) {
      patch[campo] = texto;
      sobrescritos.add(campo);
    }
  }
  if (campos.vencimento !== undefined) {
    const r = patchDeVencimento({ ...ocorrencia, sobrescritos: [...sobrescritos] }, campos.vencimento);
    if (!r.ok) return r;
    patch.vencimento = r.patch.vencimento;
    r.patch.sobrescritos.forEach((s) => sobrescritos.add(s));
    if (!r.patch.sobrescritos.includes('vencimento')) sobrescritos.delete('vencimento');
  }
  patch.sobrescritos = [...sobrescritos];
  return { ok: true, patch };
}

// Cancelar preserva o documento (⇒ nunca é regenerada) e o histórico. Realizada não cancela.
export function planejarCancelamento({ ocorrencia }) {
  return somenteSePendente(ocorrencia) ?? { ok: true, patch: { status: STATUS_CANCELADA } };
}

export function planejarRestauracao({ ocorrencia }) {
  if (!ocorrencia) return { ok: false, motivo: 'inexistente' };
  if (ocorrencia.status !== STATUS_CANCELADA) return { ok: false, motivo: 'nao_cancelada' };
  return { ok: true, patch: { status: STATUS_PENDENTE } };
}

// ---------------------------------------------------------------- ações sobre a SÉRIE

const naoVencida = (o, agora) => fimDoDiaLocal(o.vencimento) >= paraTimestamp(agora);

// Editar a série: histórico realizado, atrasadas e campos sobrescritos individualmente NÃO mudam;
// pendentes ainda não vencidas recebem a nova configuração; as futuras ainda não criadas já nascem
// com ela. Mudar o DIA da série atualiza `vencimentoOriginal` e `vencimento` (não é adiamento) das
// que não têm exceção de vencimento — salvo quando a nova data cairia no passado (aí mantém, para a
// edição não fabricar uma atrasada).
export function planejarEdicaoDaSerie({ serieAntiga, serieNova, ocorrencias, agora }) {
  const patches = [];
  const hoje = inicioDoDiaLocal(agora);
  for (const o of ocorrencias) {
    if (o.serieId !== serieAntiga.id || o.status !== STATUS_PENDENTE || !naoVencida(o, agora)) continue;
    const sobrescritos = o.sobrescritos ?? [];
    const campos = {};
    for (const campo of ['valor', 'descricao', 'categoria']) {
      if (serieNova[campo] === undefined || sobrescritos.includes(campo)) continue;
      const novo = campo === 'valor' ? reais(serieNova.valor) : serieNova[campo];
      if (novo !== o[campo]) campos[campo] = novo;
    }
    if (serieNova.tipo !== undefined && serieNova.tipo !== o.tipo) campos.tipo = serieNova.tipo;
    if (serieNova.diaDoMes !== undefined && Number(serieNova.diaDoMes) !== Number(serieAntiga.diaDoMes) && !sobrescritos.includes('vencimento')) {
      const novoVencimento = dataNoMes(o.competencia, serieNova.diaDoMes);
      if (novoVencimento !== o.vencimento && paraTimestamp(novoVencimento) >= hoje) {
        campos.vencimentoOriginal = novoVencimento;
        campos.vencimento = novoVencimento;
      }
    }
    if (Object.keys(campos).length > 0) patches.push({ id: o.id, campos });
  }
  return { patches, contagem: patches.length };
}

// Encerrar "daqui para frente": cancela só as pendentes ainda não vencidas; atrasadas e realizadas
// ficam (histórico); a série para de gerar (`encerradaEm` = primeira competência que não existe mais).
export function planejarEncerramento({ serie, ocorrencias, agora }) {
  const daSerie = ocorrencias.filter((o) => o.serieId === serie.id);
  const aCancelar = daSerie.filter((o) => o.status === STATUS_PENDENTE && naoVencida(o, agora));
  const competencias = daSerie.map((o) => o.competencia).sort();
  let encerradaEm;
  if (aCancelar.length > 0) encerradaEm = aCancelar.map((o) => o.competencia).sort()[0];
  else if (competencias.length > 0) encerradaEm = somarMesesCompetencia(competencias[competencias.length - 1], 1);
  else encerradaEm = normalizarSerie(serie).primeiraCompetencia;
  return {
    serieCampos: { ativa: false, encerradaEm },
    cancelarIds: aCancelar.map((o) => o.id),
    preservadas: {
      atrasadas: daSerie.filter((o) => statusEfetivo(o, agora) === 'atrasada').length,
      realizadas: daSerie.filter((o) => o.status === STATUS_REALIZADA).length,
    },
  };
}

// Excluir a série (criada por engano) só quando nunca houve liquidação; senão, encerrar.
export function planejarExclusaoDaSerie({ serie, ocorrencias }) {
  const daSerie = ocorrencias.filter((o) => o.serieId === serie.id);
  if (daSerie.some((o) => o.status === STATUS_REALIZADA)) return { ok: false, motivo: 'tem_realizadas' };
  return { ok: true, apagarOcorrenciaIds: daSerie.map((o) => o.id) };
}

export const podeExcluirSerie = (serie, ocorrencias) => planejarExclusaoDaSerie({ serie, ocorrencias }).ok;

// ---------------------------------------------------------------- consistência

// Estados que não podem existir: ocorrência realizada sem a transação vinculada, ou transação de
// liquidação cuja ocorrência não está realizada. O app só REPORTA (nunca apaga em silêncio).
export function inconsistenciasDeLiquidacao({ ocorrencias, transacoes }) {
  const transacoesPorId = new Map(transacoes.map((t) => [t.id, t]));
  const ocorrenciasPorId = new Map(ocorrencias.map((o) => [o.id, o]));
  const realizadaSemTransacao = ocorrencias.filter((o) => o.status === STATUS_REALIZADA && !transacoesPorId.has(o.transacaoId ?? idLiquidacao(o.id)));
  const transacaoSemOcorrencia = transacoes.filter((t) => {
    if (!ehLiquidacaoRecorrente(t)) return false;
    const o = ocorrenciasPorId.get(t.ocorrenciaId);
    return !o || o.status !== STATUS_REALIZADA;
  });
  return { realizadaSemTransacao, transacaoSemOcorrencia, temProblemas: realizadaSemTransacao.length + transacaoSemOcorrencia.length > 0 };
}
