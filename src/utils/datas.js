import { paraTimestamp } from '../dominio/tempo.js';

// Exibição apenas: a interpretação do texto de data é sempre do domínio (tempo.js),
// nunca `new Date(string)` direto — os documentos misturam hora local e UTC.
const paraData = (valor) => new Date(paraTimestamp(valor));

// Hora local no formato do <input type="datetime-local">. Não usar toISOString()
// direto aqui — ele converte pra UTC e desalinha a data exibida no formulário.
export function obterDataHoraLocal() {
  const agora = new Date();
  const offset = agora.getTimezoneOffset() * 60000;
  return new Date(agora.getTime() - offset).toISOString().slice(0, 16);
}

function mesmoDia(a, b) {
  return a.toDateString() === b.toDateString();
}

// Usado nas linhas de transação (Home + Movimentações): "Hoje, 14:32" / "Ontem" /
// "12 de outubro".
export function formatarDataRelativa(isoString) {
  const data = paraData(isoString);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (mesmoDia(data, hoje)) return `Hoje, ${hora}`;
  if (mesmoDia(data, ontem)) return 'Ontem';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

// Cabeçalho de grupo em Movimentações (o dia inteiro vira o header; a linha abaixo
// mostra só a hora) — por isso inclui o ano, diferente de `formatarDataRelativa`.
export function formatarCabecalhoData(isoString) {
  const data = paraData(isoString);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);

  if (mesmoDia(data, hoje)) return 'Hoje';
  if (mesmoDia(data, ontem)) return 'Ontem';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatarHora(isoString) {
  return paraData(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Data pura ('YYYY-MM-DD', vencimentos) ou instante, só para exibição: "14/10" e "14/10/2026".
export function formatarDiaMes(valor) {
  return paraData(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatarDataNumerica(valor) {
  return paraData(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Agenda: "15 out" e "qua, 15 out" (sem o ponto que o Intl põe nas abreviações).
const semPonto = (texto) => texto.replace('.', '');
export function formatarDataCurta(valor) {
  const data = paraData(valor);
  return `${data.getDate()} ${semPonto(data.toLocaleDateString('pt-BR', { month: 'short' }))}`;
}

export function formatarDataComDiaDaSemana(valor) {
  const data = paraData(valor);
  return `${semPonto(data.toLocaleDateString('pt-BR', { weekday: 'short' }))}, ${formatarDataCurta(valor)}`;
}
