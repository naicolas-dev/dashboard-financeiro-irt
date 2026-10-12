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
  const data = new Date(isoString);
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
  const data = new Date(isoString);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);

  if (mesmoDia(data, hoje)) return 'Hoje';
  if (mesmoDia(data, ontem)) return 'Ontem';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatarHora(isoString) {
  return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
