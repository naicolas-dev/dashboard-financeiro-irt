// Domínio puro de ASSINATURAS em cartão (cobrança mensal recorrente no cartão).
//
//   assinatura (template, `assinaturasCartao`)  →  gera  →  compra à vista em `comprasCartao`
//
// A cobrança gerada é uma compra COMO QUALQUER OUTRA: entra em `comprasCartao`, aumenta dívida/consumo e a
// fatura é classificada por `calcularPrimeiraCompetencia` (dominio/cartoes.js) — nenhuma lógica de
// competência própria aqui. NUNCA toca `transacoes`: o caixa só muda quando a fatura é paga.
//
// Compartilha com Programadas só helpers puros (tempo.js: competência, clamp 29/30/31;
// recorrencias.js: primeira competência padrão). Não é um framework de recorrência.
//
// Sem Firebase, sem React; `agora` sempre injetado. Valores em REAIS nos documentos (convenção do app).
import { paraTimestamp, mesLocal, dataNoMes, somarMesesCompetencia, ehCompetenciaValida } from './tempo.js';
import { primeiraCompetenciaPadrao } from './recorrencias.js';
import { calcularPrimeiraCompetencia } from './cartoes.js';

export const ORIGEM_ASSINATURA = 'assinatura';
const LIMITE_DE_SEGURANCA_COMPETENCIAS = 1200;

// Id determinístico: abrir o app 10×, duas abas ou relógio alterado resolvem sempre na mesma chave.
export const idCobranca = (assinaturaId, competencia) => `${assinaturaId}_${competencia}`;
export const ehCobrancaDeAssinatura = (compra) => compra?.origem === ORIGEM_ASSINATURA;

const reais = (v) => Math.round(Number(v) * 100) / 100;

export function normalizarAssinatura(doc) {
  const dia = Number(doc.diaDoMes);
  const criadaEm = doc.criadaEm ? new Date(paraTimestamp(doc.criadaEm)) : new Date();
  return {
    ...doc,
    valor: reais(doc.valor),
    diaDoMes: dia,
    ativa: doc.ativa !== false,
    primeiraCompetencia: ehCompetenciaValida(doc.primeiraCompetencia) ? doc.primeiraCompetencia : primeiraCompetenciaPadrao(dia, criadaEm),
    encerradaEm: ehCompetenciaValida(doc.encerradaEm) ? doc.encerradaEm : null,
    // Cobranças removidas pelo usuário: não são geradas de novo (senão reapareceriam a cada abertura).
    competenciasIgnoradas: Array.isArray(doc.competenciasIgnoradas) ? doc.competenciasIgnoradas : [],
  };
}

// Data da cobrança de uma competência, ajustada ao último dia do mês (31 em fevereiro = 28/29).
// Formato 'YYYY-MM-DDTHH:mm' (hora local) — o mesmo que as compras criadas pelo formulário.
export const dataDaCobranca = (assinatura, competencia) => `${dataNoMes(competencia, assinatura.diaDoMes)}T00:00`;

// Competências cuja cobrança JÁ ACONTECEU (data ≤ agora), da primeira até o encerramento. Só gera o que
// já aconteceu: cobrança futura não pode consumir limite nem aparecer como dívida antes da hora. Meses sem
// abrir o app são recuperados por inteiro.
export function competenciasDeCobranca(assinaturaBruta, agora) {
  const assinatura = normalizarAssinatura(assinaturaBruta);
  if (!assinatura.ativa && !assinatura.encerradaEm) return [];
  const instante = paraTimestamp(agora);
  const ate = mesLocal(agora);
  const lista = [];
  for (let c = assinatura.primeiraCompetencia, i = 0; c <= ate && i < LIMITE_DE_SEGURANCA_COMPETENCIAS; c = somarMesesCompetencia(c, 1), i++) {
    if (assinatura.encerradaEm && c >= assinatura.encerradaEm) break;
    if (assinatura.competenciasIgnoradas.includes(c)) continue;
    if (paraTimestamp(dataDaCobranca(assinatura, c)) > instante) continue;
    lista.push(c);
  }
  return lista;
}

// A compra concreta de uma competência. A fatura (primeiraCompetencia da compra) vem do MESMO cálculo
// de qualquer compra: data + dia de fechamento do cartão.
export function novaCobranca(assinaturaBruta, cartao, competencia, agora) {
  const assinatura = normalizarAssinatura(assinaturaBruta);
  const dataCompra = dataDaCobranca(assinatura, competencia);
  return {
    id: idCobranca(assinatura.id, competencia),
    cartaoId: assinatura.cartaoId,
    descricao: assinatura.descricao,
    categoria: assinatura.categoria,
    valorTotal: assinatura.valor,
    numeroParcelas: 1,
    dataCompra,
    primeiraCompetencia: calcularPrimeiraCompetencia(new Date(dataCompra), cartao.diaFechamento),
    origem: ORIGEM_ASSINATURA,
    assinaturaId: assinatura.id,
    competenciaCobranca: competencia,
    criadaEm: new Date(paraTimestamp(agora)).toISOString(),
  };
}

// Pura: o que falta criar. "Existe" = qualquer compra com o id determinístico, então reabrir, duas
// execuções ou duas abas dão o mesmo conjunto. Assinatura de cartão inexistente é ignorada.
export function cobrancasFaltantes({ assinaturas, compras, cartoes, agora }) {
  const existentes = new Set(compras.map((c) => c.id));
  const cartaoPorId = new Map(cartoes.map((c) => [c.id, c]));
  const faltantes = [];
  for (const bruta of assinaturas) {
    const cartao = cartaoPorId.get(bruta.cartaoId);
    if (!cartao) continue;
    const assinatura = normalizarAssinatura(bruta);
    for (const competencia of competenciasDeCobranca(assinatura, agora)) {
      if (!existentes.has(idCobranca(assinatura.id, competencia))) faltantes.push(novaCobranca(assinatura, cartao, competencia, agora));
    }
  }
  return faltantes;
}

// Para a UI: próxima cobrança ainda por vir de uma assinatura ativa ({ competencia, data } | null).
export function proximaCobranca(assinaturaBruta, agora) {
  const assinatura = normalizarAssinatura(assinaturaBruta);
  if (!assinatura.ativa) return null;
  const instante = paraTimestamp(agora);
  for (let c = assinatura.primeiraCompetencia, i = 0; i < LIMITE_DE_SEGURANCA_COMPETENCIAS; c = somarMesesCompetencia(c, 1), i++) {
    if (assinatura.encerradaEm && c >= assinatura.encerradaEm) return null;
    if (assinatura.competenciasIgnoradas.includes(c)) continue;
    const data = dataDaCobranca(assinatura, c);
    if (paraTimestamp(data) > instante) return { competencia: c, data };
  }
  return null;
}

// ---------------------------------------------------------------- ações sobre a assinatura

// Editar só afeta cobranças AINDA NÃO geradas: nada aqui toca compras existentes (histórico fica).
export function planejarEdicao({ assinatura, campos }) {
  if (!assinatura) return { ok: false, motivo: 'inexistente' };
  const patch = {};
  if (campos.descricao !== undefined) {
    const texto = String(campos.descricao).trim();
    if (!texto) return { ok: false, motivo: 'descricao_invalida' };
    patch.descricao = texto;
  }
  if (campos.valor !== undefined) {
    const valor = reais(campos.valor);
    if (!(valor > 0)) return { ok: false, motivo: 'valor_invalido' };
    patch.valor = valor;
  }
  if (campos.categoria !== undefined) {
    if (!String(campos.categoria).trim()) return { ok: false, motivo: 'categoria_invalida' };
    patch.categoria = campos.categoria;
  }
  if (campos.diaDoMes !== undefined) {
    const dia = Number(campos.diaDoMes);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return { ok: false, motivo: 'dia_invalido' };
    patch.diaDoMes = dia;
  }
  return { ok: true, patch };
}

// Cancelar = parar novas cobranças (`ativa:false`). `encerradaEm` = primeira competência SEM cobrança: se a
// cobrança deste mês já aconteceu, é o mês seguinte; senão, este mês. Nada é apagado.
// (O serviço gera as cobranças pendentes ANTES de cancelar, para não perder meses sem abrir.)
export function planejarCancelamento({ assinatura, agora }) {
  if (!assinatura) return { ok: false, motivo: 'inexistente' };
  const a = normalizarAssinatura(assinatura);
  if (!a.ativa) return { ok: false, motivo: 'ja_cancelada' };
  const mes = mesLocal(agora);
  const jaCobrouNoMes = paraTimestamp(dataDaCobranca(a, mes)) <= paraTimestamp(agora);
  let encerradaEm = jaCobrouNoMes ? somarMesesCompetencia(mes, 1) : mes;
  if (encerradaEm < a.primeiraCompetencia) encerradaEm = a.primeiraCompetencia;
  return { ok: true, patch: { ativa: false, encerradaEm } };
}

// Excluir a configuração só quando NUNCA gerou cobrança (criada por engano); senão, cancelar.
export function planejarExclusao({ assinatura, compras }) {
  if (!assinatura) return { ok: false, motivo: 'inexistente' };
  if (compras.some((c) => c.assinaturaId === assinatura.id)) return { ok: false, motivo: 'tem_cobrancas' };
  return { ok: true };
}

export const podeExcluirAssinatura = (assinatura, compras) => planejarExclusao({ assinatura, compras }).ok;
