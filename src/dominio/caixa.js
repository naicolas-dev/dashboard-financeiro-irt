// Domínio puro do livro-caixa: SALDO (posição acumulada) × MÉTRICAS DE PERÍODO
// (atividade dentro de um intervalo). Em centavos, com `agora` injetado.
//
//   saldo      = Σ entradas − Σ saídas de caixa REALIZADAS (data ≤ agora), desde o
//                início do histórico — não expira, não depende de janela nem do que
//                a tela está mostrando
//   métricas   = Entradas/Saídas/resultado do mês: só dentro do período pedido
//
// "Movimento de caixa" vem de UMA fonte (`ehMovimentacaoDeCaixa`, Cartões V2): compra
// no cartão e parcela legada não entram; pagamento de fatura entra. Meta (guardar/
// retirar) nunca é transação, então nunca passa por aqui.
import { ehMovimentacaoDeCaixa } from './cartoes.js';
import { paraTimestamp, mesLocal, inicioDoDiaHaMeses } from './tempo.js';

// Período do Hero (Entradas/Saídas). Antes era um efeito colateral da janela de
// carregamento; agora é uma regra explícita, com a mesma duração.
export const MESES_PERIODO_HERO = 12;

const centavos = (valor) => Math.round(Number(valor) * 100);
const sinalDoTipo = (t) => (t.tipo === 'receita' ? 1 : t.tipo === 'despesa' ? -1 : 0);

// Caixa já realizado: ignora o que não é caixa, o que ainda está no futuro e datas
// que não dá pra interpretar (nunca entram "no chute").
export function movimentacoesRealizadas(transacoes, agora) {
  const limite = paraTimestamp(agora);
  return transacoes.filter((t) => {
    if (!ehMovimentacaoDeCaixa(t)) return false;
    const ts = paraTimestamp(t.data);
    return Number.isFinite(ts) && ts <= limite;
  });
}

// Documentos de caixa cuja data não pôde ser interpretada (ficam fora do saldo).
export function movimentacoesComDataInvalida(transacoes) {
  return transacoes.filter((t) => ehMovimentacaoDeCaixa(t) && !Number.isFinite(paraTimestamp(t.data)));
}

export function calcularSaldoFinanceiroCentavos(transacoes, agora) {
  return movimentacoesRealizadas(transacoes, agora).reduce((acc, t) => acc + sinalDoTipo(t) * centavos(t.valor), 0);
}

// Saldo disponível = saldo − dinheiro reservado em metas (reserva lógica, sem transação).
export function calcularSaldoDisponivelCentavos(saldoFinanceiroCentavos, totalReservadoCentavos) {
  return saldoFinanceiroCentavos - totalReservadoCentavos;
}

// Entradas e saídas realizadas dentro de [inicio, fim] (fim limitado a `agora`).
export function resumoDoPeriodo(transacoes, { inicio, fim, agora }) {
  const ini = paraTimestamp(inicio);
  const limite = Math.min(paraTimestamp(fim ?? agora), paraTimestamp(agora));
  let entradasCentavos = 0;
  let saidasCentavos = 0;
  for (const t of movimentacoesRealizadas(transacoes, agora)) {
    const ts = paraTimestamp(t.data);
    if (ts < ini || ts > limite) continue;
    if (t.tipo === 'receita') entradasCentavos += centavos(t.valor);
    else if (t.tipo === 'despesa') saidasCentavos += centavos(t.valor);
  }
  return { entradasCentavos, saidasCentavos };
}

// Entradas/Saídas exibidas no Hero: últimos `MESES_PERIODO_HERO` meses, até agora.
export function resumoDoHero(transacoes, agora) {
  return resumoDoPeriodo(transacoes, { inicio: inicioDoDiaHaMeses(agora, MESES_PERIODO_HERO), fim: agora, agora });
}

// Resultado do mês corrente (entradas − saídas realizadas no mês LOCAL).
export function resultadoDoMesCentavos(transacoes, agora) {
  const mes = mesLocal(agora);
  return movimentacoesRealizadas(transacoes, agora)
    .filter((t) => mesLocal(t.data) === mes)
    .reduce((acc, t) => acc + sinalDoTipo(t) * centavos(t.valor), 0);
}
