// Domínio puro de Cartões V2 — sem Firebase, sem React, sem relógio implícito
// (`hoje` sempre é parâmetro). Todo dinheiro aqui é em CENTAVOS inteiros.
//
// Modelo:
//   - consumo  = compras de cartão (`comprasCartao`); parcelas são DERIVADAS da compra
//   - dívida   = parcelas − pagamentos alocados (nunca um contador gravado)
//   - caixa    = `transacoes` (inclui pagamentos de fatura; nunca compras/parcelas)
// Competência = mês em que a fatura FECHA (chave 'YYYY-MM', semântica herdada).

export const NATUREZA_PAGAMENTO_FATURA = 'pagamento_fatura';

export const paraCentavos = (valor) => Math.round(Number(valor) * 100);
export const paraReais = (centavos) => centavos / 100;

// ---------------------------------------------------------------- caixa

// Única definição de "movimentação de caixa". Parcelas legadas (documentos em
// `transacoes` com origem 'cartao', do modelo antigo) NÃO são caixa — o dinheiro só
// sai no pagamento da fatura. Ninguém mais deve checar `origem` fora daqui.
export function ehMovimentacaoDeCaixa(transacao) {
  return transacao.origem !== 'cartao';
}

export function movimentacoesDeCaixa(transacoes) {
  return transacoes.filter(ehMovimentacaoDeCaixa);
}

export function ehPagamentoDeFatura(transacao) {
  return transacao.natureza === NATUREZA_PAGAMENTO_FATURA;
}

// ---------------------------------------------------------------- competência e ciclo

function formatarCompetencia(ano, mesIndex) {
  const d = new Date(ano, mesIndex, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function partes(competencia) {
  const [ano, mes] = competencia.split('-').map(Number);
  return { ano, mesIndex: mes - 1 };
}

const ultimoDiaDoMes = (ano, mesIndex) => new Date(ano, mesIndex + 1, 0).getDate();

export function adicionarMesesCompetencia(competencia, n) {
  const { ano, mesIndex } = partes(competencia);
  return formatarCompetencia(ano, mesIndex + n);
}

export function competenciaDaData(data) {
  return formatarCompetencia(data.getFullYear(), data.getMonth());
}

// Início do dia (00:00 local) em que a fatura da competência fecha. Dia clampado ao
// último dia do mês (fechamento "31" em fevereiro = dia 28/29).
export function dataFechamento(competencia, diaFechamento) {
  const { ano, mesIndex } = partes(competencia);
  return new Date(ano, mesIndex, Math.min(diaFechamento, ultimoDiaDoMes(ano, mesIndex)));
}

// Vencimento: no mesmo mês do fechamento se o dia de vencimento vem depois do de
// fechamento; senão no mês seguinte (ex.: fecha 28, vence 5 → vence dia 5 do mês
// seguinte). O modelo antigo sempre usava o mesmo mês — bug corrigido aqui.
export function dataVencimento(competencia, { diaFechamento, diaVencimento }) {
  const { ano, mesIndex } = partes(competencia);
  const mesVenc = diaVencimento > diaFechamento ? mesIndex : mesIndex + 1;
  const base = new Date(ano, mesVenc, 1);
  return new Date(base.getFullYear(), base.getMonth(), Math.min(diaVencimento, ultimoDiaDoMes(base.getFullYear(), base.getMonth())));
}

// Compra no dia do fechamento (ou depois) cai na fatura seguinte.
export function calcularPrimeiraCompetencia(data, diaFechamento) {
  const d = data instanceof Date ? data : new Date(data);
  const competenciaDoMes = competenciaDaData(d);
  const fechamentoDoMes = dataFechamento(competenciaDoMes, diaFechamento);
  return d.getDate() >= fechamentoDoMes.getDate() ? adicionarMesesCompetencia(competenciaDoMes, 1) : competenciaDoMes;
}

// Fatura que está recebendo compras hoje.
export function competenciaAberta(cartao, hoje) {
  return calcularPrimeiraCompetencia(hoje, cartao.diaFechamento);
}

function inicioDoDia(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function statusCiclo(competencia, cartao, hoje) {
  const h = inicioDoDia(hoje);
  if (h < dataFechamento(competencia, cartao.diaFechamento)) return 'aberta';
  if (h > dataVencimento(competencia, cartao)) return 'vencida';
  return 'fechada';
}

// ---------------------------------------------------------------- parcelas

// Centavos inteiros; o resto da divisão vai para as primeiras parcelas.
export function gerarValoresParcelas(valorTotalCentavos, numeroParcelas) {
  const base = Math.floor(valorTotalCentavos / numeroParcelas);
  const resto = valorTotalCentavos - base * numeroParcelas;
  return Array.from({ length: numeroParcelas }, (_, i) => (i < resto ? base + 1 : base));
}

// Parcelas de uma compra. Se a compra tem cronograma explícito (`parcelas`, gravado
// só para dados legados divergentes ou importação futura), ele prevalece.
export function parcelasDaCompra(compra) {
  const cronograma = Array.isArray(compra.parcelas) && compra.parcelas.length > 0
    ? compra.parcelas.map((p) => ({ competencia: p.competencia, centavos: paraCentavos(p.valor) }))
    : gerarValoresParcelas(paraCentavos(compra.valorTotal), compra.numeroParcelas).map((centavos, i) => ({
        competencia: adicionarMesesCompetencia(compra.primeiraCompetencia, i),
        centavos,
      }));

  return cronograma.map((p, i) => ({
    id: `${compra.id}#${i + 1}`,
    compraCartaoId: compra.id,
    cartaoId: compra.cartaoId,
    competencia: p.competencia,
    centavos: p.centavos,
    parcelaAtual: i + 1,
    totalParcelas: cronograma.length,
    descricao: compra.descricao,
    categoria: compra.categoria,
    valorTotalCompraCentavos: paraCentavos(compra.valorTotal),
  }));
}

// ---------------------------------------------------------------- alocação de pagamentos

// ÚNICO lugar que decide "quanto de cada fatura está pago". Determinístico:
//   1. pagamentos ordenados por data e, no empate, por id;
//   2. cada pagamento começa na competência informada e quita o restante dela;
//   3. o que sobrar segue para as competências seguintes, em ordem cronológica.
// Nunca volta para competências anteriores à informada. `naoAlocadoCentavos` > 0
// indica pagamento acima do que existia a partir da competência alvo (a UI impede;
// aqui só é reportado, nunca vira saldo credor).
//
// totaisPorCompetencia: { 'YYYY-MM': centavos }
// pagamentos: [{ id, data, competencia, centavos }]
export function alocarPagamentos(totaisPorCompetencia, pagamentos) {
  const competencias = Object.keys(totaisPorCompetencia).sort();
  const pago = Object.fromEntries(competencias.map((c) => [c, 0]));
  const ordenados = [...pagamentos].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const porPagamento = {};
  for (const pagamento of ordenados) {
    let resta = pagamento.centavos;
    const alocacoes = [];
    for (const c of competencias) {
      if (resta <= 0) break;
      if (c < pagamento.competencia) continue;
      const livre = totaisPorCompetencia[c] - pago[c];
      if (livre <= 0) continue;
      const usado = Math.min(livre, resta);
      pago[c] += usado;
      resta -= usado;
      alocacoes.push({ competencia: c, centavos: usado });
    }
    porPagamento[pagamento.id] = { alocacoes, naoAlocadoCentavos: resta };
  }

  const porCompetencia = Object.fromEntries(
    competencias.map((c) => [c, { totalCentavos: totaisPorCompetencia[c], pagoCentavos: pago[c], restanteCentavos: totaisPorCompetencia[c] - pago[c] }])
  );
  return { porCompetencia, porPagamento };
}

// ---------------------------------------------------------------- faturas e resumo

function pagamentosDoCartao(pagamentos, cartaoId) {
  return pagamentos
    .filter((p) => p.cartaoId === cartaoId)
    .map((p) => ({ id: p.id, data: p.data, competencia: p.competencia, centavos: paraCentavos(p.valor) }));
}

export function statusPagamento({ pagoCentavos, restanteCentavos }) {
  if (restanteCentavos <= 0) return 'paga';
  return pagoCentavos > 0 ? 'parcial' : 'nao_paga';
}

// Faturas de um cartão: uma por competência que tem parcela, em ordem cronológica.
// `pagamentos` = transações de pagamento de fatura (formato do Firestore, valor em
// reais); só as deste cartão são consideradas.
export function faturasDoCartao({ cartao, compras, pagamentos, hoje }) {
  const parcelas = compras.filter((c) => c.cartaoId === cartao.id).flatMap(parcelasDaCompra);
  const totais = {};
  for (const p of parcelas) totais[p.competencia] = (totais[p.competencia] ?? 0) + p.centavos;

  const { porCompetencia, porPagamento } = alocarPagamentos(totais, pagamentosDoCartao(pagamentos, cartao.id));

  const faturas = Object.keys(porCompetencia)
    .sort()
    .map((competencia) => {
      const valores = porCompetencia[competencia];
      return {
        competencia,
        ...valores,
        fechamento: dataFechamento(competencia, cartao.diaFechamento),
        vencimento: dataVencimento(competencia, cartao),
        statusCiclo: statusCiclo(competencia, cartao, hoje),
        statusPagamento: statusPagamento(valores),
        parcelas: parcelas.filter((p) => p.competencia === competencia),
      };
    });

  return { faturas, porPagamento };
}

// Quanto um pagamento destinado a `competencia` pode valer no máximo: o restante
// daquela fatura e de todas as seguintes (o pagamento nunca volta no tempo). Como as
// faturas seguintes são subconjunto da dívida, isso nunca passa da dívida total.
// `ignorarPagamentoId`: na edição, o próprio pagamento sai da conta.
export function maximoPagamentoCentavos({ cartao, compras, pagamentos, hoje, competencia, ignorarPagamentoId }) {
  const outros = ignorarPagamentoId ? pagamentos.filter((p) => p.id !== ignorarPagamentoId) : pagamentos;
  const { faturas } = faturasDoCartao({ cartao, compras, pagamentos: outros, hoje });
  return faturas.filter((f) => f.competencia >= competencia).reduce((a, f) => a + f.restanteCentavos, 0);
}

export function resumoDoCartao({ cartao, compras, pagamentos, hoje }) {
  const { faturas } = faturasDoCartao({ cartao, compras, pagamentos, hoje });
  const aberta = competenciaAberta(cartao, hoje);
  const faturaAtual = faturas.find((f) => f.competencia === aberta) ?? null;
  const dividaCentavos = faturas.reduce((a, f) => a + f.restanteCentavos, 0);
  const proximasParcelasCentavos = faturas.filter((f) => f.competencia > aberta).reduce((a, f) => a + f.restanteCentavos, 0);
  const aPagar = faturas.filter((f) => f.competencia < aberta && f.restanteCentavos > 0);

  return {
    competenciaAberta: aberta,
    faturaAtual,
    faturaAtualCentavos: faturaAtual?.totalCentavos ?? 0,
    faturaAtualRestanteCentavos: faturaAtual?.restanteCentavos ?? 0,
    faturasAPagar: aPagar,
    dividaCentavos,
    proximasParcelasCentavos,
    limiteDisponivelCentavos: paraCentavos(cartao.limiteTotal) - dividaCentavos,
    faturas,
  };
}

// Compra com qualquer parcela numa fatura que já fechou OU que já recebeu pagamento
// (inclusive por antecipação) tem histórico financeiro. Editar/excluir continua
// permitido (pode ter sido um lançamento errado), mas nunca em silêncio: a UI mostra
// `aviso` antes de confirmar. Pagamentos já registrados nunca mudam — o que mudar é o
// total das faturas; se um pagamento passar a sobrar, a alocação o empurra pras
// faturas seguintes.
export function regrasDaCompra({ compra, cartao, compras, pagamentos, hoje }) {
  const { faturas } = faturasDoCartao({ cartao, compras, pagamentos, hoje });
  const porCompetencia = Object.fromEntries(faturas.map((f) => [f.competencia, f]));
  const temHistorico = parcelasDaCompra(compra).some((p) => {
    const f = porCompetencia[p.competencia];
    return statusCiclo(p.competencia, cartao, hoje) !== 'aberta' || (f && f.pagoCentavos > 0);
  });
  return {
    podeAlterarValor: true,
    podeExcluir: true,
    temHistorico,
    aviso: temHistorico
      ? 'Esta compra já tem parcela em fatura fechada ou paga. Alterar ou excluir muda o total dessas faturas; os pagamentos já registrados continuam como estão.'
      : null,
  };
}

// Consumo no cartão num mês (critério econômico: valor total na data da compra).
export function gastosNoCartaoNoMes({ compras, cartaoId, hoje }) {
  const alvo = competenciaDaData(hoje);
  return compras
    .filter((c) => c.cartaoId === cartaoId && competenciaDaData(new Date(c.dataCompra)) === alvo)
    .reduce((a, c) => a + paraCentavos(c.valorTotal), 0);
}

// Validação de um pagamento (criação ou edição). Bloqueio só para o que o modelo não
// representa (valor ≤ 0 ou acima do máximo alocável); saldo insuficiente é AVISO,
// decidido pela UI (registrar mesmo assim é permitido).
export function validarPagamento({ valorCentavos, maximoCentavos, saldoFinanceiroCentavos, saldoDisponivelCentavos }) {
  if (!(valorCentavos > 0)) return { ok: false, erro: 'Informe um valor maior que zero.' };
  if (valorCentavos > maximoCentavos) return { ok: false, erro: 'O valor passa da dívida restante do cartão a partir desta fatura.' };
  let aviso = null;
  if (valorCentavos > saldoFinanceiroCentavos) aviso = 'saldo_negativo';
  else if (valorCentavos > saldoDisponivelCentavos) aviso = 'usa_reservado';
  return { ok: true, aviso };
}
