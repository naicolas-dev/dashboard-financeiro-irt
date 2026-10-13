// Gera um conjunto SINTÉTICO de dados no formato do modelo antigo (pré-V2), usando
// as mesmas regras que o `criarCompraCartao` antigo usava (inclusive o vencimento
// sempre no mês da competência). Serve só pra validar a migração com dry-run
// (`migrar.mjs --fixture=...`) — nada aqui toca o Firestore.
import fs from 'node:fs';
import { gerarValoresParcelasLegado, adicionarMesesLegado } from './legado.mjs';

const AGORA = new Date(2026, 9, 12, 21, 0); // 12/out/2026 21:00 local
const cartoes = [
  { id: 'nu', nome: 'Nubank', limiteTotal: 5000, diaFechamento: 3, diaVencimento: 10 },
  { id: 'it', nome: 'Itaú', limiteTotal: 8000, diaFechamento: 28, diaVencimento: 5 }, // vence no mês seguinte
];

function competenciaAntiga(dataISO, diaFechamento) {
  const d = new Date(dataISO);
  const base = d.getDate() >= diaFechamento ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : new Date(d.getFullYear(), d.getMonth(), 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
}
function dataParcelaAntiga(competencia, diaVencimento) {
  const [a, m] = competencia.split('-').map(Number);
  return new Date(a, m - 1, Math.min(diaVencimento, new Date(a, m, 0).getDate())).toISOString();
}

const comprasCartao = [];
const transacoes = [];
function compraAntiga(id, cartao, valorTotal, numeroParcelas, dataCompra, descricao) {
  const primeiraCompetencia = competenciaAntiga(dataCompra, cartao.diaFechamento);
  comprasCartao.push({ id, cartaoId: cartao.id, descricao, categoria: 'Outro', valorTotal, numeroParcelas, dataCompra, primeiraCompetencia });
  gerarValoresParcelasLegado(Math.round(valorTotal * 100), numeroParcelas).forEach((c, i) => {
    const competencia = adicionarMesesLegado(primeiraCompetencia, i);
    transacoes.push({
      id: `${id}-p${i + 1}`,
      descricao,
      valor: c / 100,
      tipo: 'despesa',
      categoria: 'Outro',
      data: dataParcelaAntiga(competencia, cartao.diaVencimento),
      origem: 'cartao',
      cartaoId: cartao.id,
      compraCartaoId: id,
      parcelaAtual: i + 1,
      totalParcelas: numeroParcelas,
      valorTotalCompra: valorTotal,
      competencia,
    });
  });
}

const [nu, it] = cartoes;
compraAntiga('notebook', nu, 1200, 6, '2026-06-15T10:00', 'Notebook'); // jul..dez: parte passada, parte futura
compraAntiga('mercado', nu, 300, 1, '2026-10-01T10:00', 'Mercado'); // à vista, vence 10/out (passado)
compraAntiga('antiga', nu, 900, 3, '2025-06-20T10:00', 'Compra antiga'); // parcelas antes da janela de 12 meses
compraAntiga('celular', it, 2400, 12, '2026-09-10T10:00', 'Celular'); // cartão que vence no mês seguinte
compraAntiga('tv', nu, 1000, 4, '2026-08-20T10:00', 'TV');
// Divergência: uma parcela da TV foi excluída individualmente pela tela antiga
transacoes.splice(transacoes.findIndex((t) => t.id === 'tv-p2'), 1);
// Órfã: parcela cuja compra foi apagada fora do fluxo
transacoes.push({ id: 'orfa-1', descricao: 'Órfã', valor: 50, tipo: 'despesa', categoria: 'Outro', data: '2026-09-10T03:00:00.000Z', origem: 'cartao', cartaoId: 'nu', compraCartaoId: 'sumiu', competencia: '2026-09' });
// Caixa comum
transacoes.push({ id: 'salario', descricao: 'Salário', valor: 6000, tipo: 'receita', categoria: 'Salário', data: '2026-10-05T09:00' });
transacoes.push({ id: 'pix', descricao: 'Pix', valor: 250, tipo: 'despesa', categoria: 'Lazer', data: '2026-10-07T12:00' });

const destino = process.argv[2] ?? 'fixture-legado.json';
fs.writeFileSync(destino, JSON.stringify({ agora: AGORA.toISOString(), cartoes, comprasCartao, transacoes }, null, 2));
console.log(`Fixture: ${cartoes.length} cartões, ${comprasCartao.length} compras, ${transacoes.length} transações → ${destino}`);
