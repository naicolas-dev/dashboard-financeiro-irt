// AUTORIDADE ÚNICA de interpretação e comparação temporal do app. Nenhuma decisão
// financeira (saldo, ordenação, filtro, "hoje"/futuro, início/fim de período) pode
// comparar strings de data nem chamar `new Date(string)` direto — tudo passa por aqui.
//
// Formatos reais encontrados no Firestore (inventário de 2026-10-14):
//   'YYYY-MM-DDTHH:mm'            local, SEM timezone (formulários) → hora LOCAL
//   'YYYY-MM-DDTHH:mm:ss[.sss]Z'  UTC (geradas por toISOString)     → instante absoluto
// Também aceitos (prontos para Open Finance): ISO com offset, só-data (meia-noite
// LOCAL), `Date`, número (ms) e `Timestamp` do Firestore.
//
// Representação de cálculo = milissegundos desde a época (número). A exibição
// localizada em pt-BR é um assunto separado (utils/datas.js).

const RE_SEM_TZ = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/;
const RE_COM_TZ = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

function dataLocalValida(ano, mes, dia, hora, minuto, segundo, ms) {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || minuto > 59 || segundo > 59) return NaN;
  const d = new Date(ano, mes - 1, dia, hora, minuto, segundo, ms);
  // Rejeita datas que o Date "corrige" sozinho (ex.: 31/02 vira 03/03).
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return NaN;
  return d.getTime();
}

// → milissegundos (número) ou NaN se não der pra interpretar com segurança.
export function paraTimestamp(valor) {
  if (valor === null || valor === undefined) return NaN;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  if (valor instanceof Date) return valor.getTime();

  if (typeof valor === 'object') {
    if (typeof valor.toMillis === 'function') return valor.toMillis();
    if (typeof valor.seconds === 'number') return valor.seconds * 1000 + Math.floor((valor.nanoseconds ?? 0) / 1e6);
    return NaN;
  }

  if (typeof valor !== 'string') return NaN;
  const texto = valor.trim();

  if (RE_COM_TZ.test(texto)) {
    // '+0300' → '+03:00' (nem todo motor aceita o offset sem os dois-pontos).
    const normalizado = texto.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    return Date.parse(normalizado);
  }

  const m = RE_SEM_TZ.exec(texto);
  if (!m) return NaN;
  const [, ano, mes, dia, hora = '0', minuto = '0', segundo = '0', fracao = '0'] = m;
  const ms = Number(`0.${fracao}`) * 1000;
  return dataLocalValida(Number(ano), Number(mes), Number(dia), Number(hora), Number(minuto), Number(segundo), Math.floor(ms));
}

export const ehDataValida = (valor) => Number.isFinite(paraTimestamp(valor));

// true quando o instante já chegou (≤ agora). Exatamente em `agora` conta como já ocorrido.
export function jaOcorreu(valor, agora) {
  const t = paraTimestamp(valor);
  const limite = paraTimestamp(agora);
  return Number.isFinite(t) && Number.isFinite(limite) && t <= limite;
}

// Mais recente primeiro; desempate estável por `id`; datas inválidas vão pro fim.
export function compararPorTempoDesc(a, b) {
  const ta = paraTimestamp(a.data);
  const tb = paraTimestamp(b.data);
  const va = Number.isFinite(ta);
  const vb = Number.isFinite(tb);
  if (va !== vb) return va ? -1 : 1;
  if (va && ta !== tb) return tb - ta;
  const ia = String(a.id ?? '');
  const ib = String(b.id ?? '');
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

const dois = (n) => String(n).padStart(2, '0');

// Valor pro <input>/DateTimeField: 'YYYY-MM-DDTHH:mm' na hora LOCAL. Num doc em UTC
// ('…T03:00:00.000Z') devolve a hora local certa (00:00 em Brasília), não "03:00" —
// `slice(0,16)` mostrava a hora UTC e, ao salvar, a transação andava +3h.
export function paraInputLocal(valor) {
  const t = paraTimestamp(valor);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

// 'YYYY-MM' do mês LOCAL (nunca o mês em UTC).
export function mesLocal(valor) {
  const t = paraTimestamp(valor);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}`;
}

export function inicioDoDiaLocal(valor) {
  const t = paraTimestamp(valor);
  if (!Number.isFinite(t)) return NaN;
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

export function fimDoDiaLocal(valor) {
  const t = paraTimestamp(valor);
  if (!Number.isFinite(t)) return NaN;
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

// "N meses atrás, às 00:00 local" (mesma regra que a antiga janela usava).
export function inicioDoDiaHaMeses(agora, meses) {
  const d = new Date(paraTimestamp(agora));
  d.setMonth(d.getMonth() - meses);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
