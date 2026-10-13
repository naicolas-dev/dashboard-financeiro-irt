// Cópia CONGELADA do comportamento do modelo antigo (pré-Cartões V2). A migração
// precisa reproduzir exatamente o que o app antigo calculava, independente de como
// o domínio novo evoluir — por isso não importa nada de src/.

// = src/servicos/cartoes.js (antigo) gerarValoresParcelas
export function gerarValoresParcelasLegado(valorTotalCentavos, numeroParcelas) {
  const base = Math.floor(valorTotalCentavos / numeroParcelas);
  const resto = valorTotalCentavos - base * numeroParcelas;
  return Array.from({ length: numeroParcelas }, (_, i) => (i < resto ? base + 1 : base));
}

// = adicionarMesesCompetencia (antigo)
export function adicionarMesesLegado(competencia, n) {
  const [ano, mes] = competencia.split('-').map(Number);
  const d = new Date(ano, mes - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// = src/hooks/useDadosFinanceiros.js inicioPadrao() + fim da janela do carregamento
// inicial. Comparação por STRING ISO, exatamente como a query do Firestore faz.
export function janelaLegada(agora = new Date()) {
  const inicio = new Date(agora);
  inicio.setMonth(inicio.getMonth() - 12);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(agora);
  fim.setDate(fim.getDate() + 1);
  return { inicioISO: inicio.toISOString(), fimISO: fim.toISOString() };
}

export function dentroDaJanela(t, { inicioISO, fimISO }) {
  return typeof t.data === 'string' && t.data >= inicioISO && t.data <= fimISO;
}

// = saldoFinanceiro / resumo.saldo (antigos): receitas − despesas das transações da
// janela, sem distinguir parcela de cartão de despesa de caixa.
export function saldoLegado(transacoes, janela) {
  let saldo = 0;
  for (const t of transacoes) {
    if (!dentroDaJanela(t, janela)) continue;
    if (t.tipo === 'receita') saldo += Math.round(t.valor * 100);
    else if (t.tipo === 'despesa') saldo -= Math.round(t.valor * 100);
  }
  return saldo; // centavos
}
