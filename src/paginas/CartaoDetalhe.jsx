import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SegmentGroup } from '@chakra-ui/react';
import { InboxIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import EmptyState from '../componentes/ui/EmptyState.jsx';
import IconButton from '../componentes/ui/IconButton.jsx';
import Button from '../componentes/ui/Button.jsx';
import ResponsiveDialog from '../componentes/ui/ResponsiveDialog.jsx';
import Badge from '../componentes/ui/Badge.jsx';
import PaymentCardForm from '../componentes/PaymentCardForm.jsx';
import PurchaseDetails from '../componentes/PurchaseDetails.jsx';
import CardPurchasesTab from '../componentes/CardPurchasesTab.jsx';
import SubscriptionsTab from '../componentes/SubscriptionsTab.jsx';
import SubscriptionForm from '../componentes/SubscriptionForm.jsx';
import SubscriptionActions from '../componentes/SubscriptionActions.jsx';
import TransactionFlow from '../componentes/TransactionFlow.jsx';
import InvoicePaymentDialog from '../componentes/InvoicePaymentDialog.jsx';
import { adicionarMesesCompetencia, nomeFatura } from '../servicos/cartoes.js';
import { gastosNoCartaoNoMes } from '../dominio/cartoes.js';
import { paraTimestamp, compararPorTempoDesc } from '../dominio/tempo.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = (centavos) => formatadorMoeda.format(centavos / 100);
const diaMes = (data) => data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const ROTULO_CICLO = { aberta: 'Aberta', fechada: 'Fechada', vencida: 'Vencida' };

// Status em duas dimensões (ciclo × pagamento) — "vencida e parcialmente paga" existe.
function BadgesFatura({ fatura }) {
  if (!fatura) return null;
  if (fatura.statusPagamento === 'paga') return <Badge variant="positive">Paga</Badge>;
  return (
    <span className="flex items-center gap-1">
      <Badge variant={fatura.statusCiclo === 'vencida' ? 'warning' : 'neutro'}>{ROTULO_CICLO[fatura.statusCiclo]}</Badge>
      {fatura.statusPagamento === 'parcial' && <Badge variant="warning">Parcialmente paga</Badge>}
    </span>
  );
}

// Ícones operam sobre a COMPRA (via compraCartaoId), não sobre a parcela isolada.
const ParcelaRow = ({ parcela, ehAssinatura = false, onEditarCompra, onExcluirCompra }) => {
  const ehParcelada = parcela.totalParcelas > 1;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{parcela.descricao}</p>
        <p className="text-xs text-foreground-muted">
          {parcela.categoria} · {ehParcelada ? `Parcela ${parcela.parcelaAtual}/${parcela.totalParcelas}` : 'À vista'}
          {ehAssinatura ? ' · Assinatura' : ''}
        </p>
        {ehParcelada && <p className="text-xs text-foreground-muted">Total da compra: {brl(parcela.valorTotalCompraCentavos)}</p>}
      </div>
      <p className="font-semibold tabular-nums text-foreground shrink-0">{brl(parcela.centavos)}</p>
      <div className="flex items-center gap-0.5 shrink-0">
        <IconButton aria-label={`Editar compra de ${parcela.descricao}`} onClick={onEditarCompra}>
          <PencilSquareIcon className="h-5 w-5" />
        </IconButton>
        <IconButton aria-label={`Excluir compra de ${parcela.descricao}`} variant="danger" onClick={onExcluirCompra}>
          <TrashIcon className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  );
};

const Indicador = ({ rotulo, valor, detalhe }) => (
  <div className="rounded-xl bg-surface p-3">
    <p className="text-xs text-foreground-muted">{rotulo}</p>
    <p className="text-sm font-semibold text-foreground tabular-nums">{valor}</p>
    {detalhe && <p className="text-xs text-foreground-muted tabular-nums">{detalhe}</p>}
  </div>
);

// Detalhe do cartão: dívida/fatura/limite derivados pelo domínio (cartao.resumo),
// faturas por competência com status em duas dimensões e pagamento de fatura — a
// única saída de caixa do cartão. Compras e pagamentos já vêm carregados do hook.
const CartaoDetalhe = ({
  cartaoId,
  cartoes,
  comprasCartao,
  pagamentosFatura,
  saldoFinanceiro,
  saldoDisponivel,
  onVoltar,
  handleCartaoSalvo,
  handleCompraCriada,
  handlePagamentoSalvo,
  excluirCartao,
  excluirCompra,
  excluirVariasCompras,
  excluirTransacao,
  handleCompraAtualizada,
  regrasCompra,
  validarAlteracaoCompras,
  contextoPagamento,
  assinaturasCartao,
  assinaturasIndisponiveis,
  criarAssinaturaCartao,
  editarAssinaturaCartao,
  cancelarAssinaturaCartao,
  excluirAssinaturaCartao,
  podeExcluirAssinaturaCartao,
}) => {
  const cartao = cartoes.find((c) => c.id === cartaoId);
  const resumo = cartao?.resumo;
  const aberta = resumo?.competenciaAberta;
  const pillAtivaRef = useRef(null);

  const competencias = useMemo(() => (aberta ? Array.from({ length: 12 }, (_, i) => adicionarMesesCompetencia(aberta, i - 8)) : []), [aberta]);
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState(aberta);
  const [aba, setAba] = useState('extrato'); // 'extrato' | 'compras' | 'assinaturas'
  const [cartaoEditandoAberto, setCartaoEditandoAberto] = useState(false);
  const [compraEditando, setCompraEditando] = useState(null);
  const [novaCompraAberta, setNovaCompraAberta] = useState(false);
  // { modo: 'criar' } | { modo: 'menu' | 'editar', id } — gestão das assinaturas deste cartão
  const [assinaturaDialogo, setAssinaturaDialogo] = useState(null);
  // { competencia, pagamento? } — pagamento presente = edição
  const [pagamentoDialogo, setPagamentoDialogo] = useState(null);

  useEffect(() => {
    pillAtivaRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []);

  const comprasDoCartao = useMemo(() => comprasCartao.filter((c) => c.cartaoId === cartaoId), [comprasCartao, cartaoId]);
  const assinaturasDoCartao = useMemo(() => assinaturasCartao.filter((a) => a.cartaoId === cartaoId), [assinaturasCartao, cartaoId]);
  const gastosDoMes = useMemo(() => gastosNoCartaoNoMes({ compras: comprasCartao, cartaoId, hoje: new Date() }), [comprasCartao, cartaoId]);

  if (!cartao) return null;

  const assinaturaSelecionada = assinaturaDialogo?.id ? assinaturasDoCartao.find((a) => a.id === assinaturaDialogo.id) : null;

  const faturaPorCompetencia = Object.fromEntries(resumo.faturas.map((f) => [f.competencia, f]));
  const faturaSelecionada = faturaPorCompetencia[competenciaSelecionada] ?? null;
  const pagamentosDaCompetencia = pagamentosFatura
    .filter((p) => p.cartaoId === cartaoId && p.competencia === competenciaSelecionada)
    .sort(compararPorTempoDesc);

  const abrirEditarCompraPorId = (compraId) => {
    const compra = comprasCartao.find((c) => c.id === compraId);
    if (compra) setCompraEditando(compra);
  };
  const excluirCompraPorId = (compraId) => {
    const compra = comprasCartao.find((c) => c.id === compraId);
    if (compra) excluirCompra(compra);
  };

  const dialogo =
    pagamentoDialogo &&
    contextoPagamento({ cartaoId, competencia: pagamentoDialogo.competencia, ignorarPagamentoId: pagamentoDialogo.pagamento?.id });

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onVoltar} className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 -ml-2 rounded-lg">
          ← Voltar
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-1 -ml-1">
          <h1 className="text-xl font-semibold text-foreground">{cartao.nome}</h1>
          <IconButton aria-label="Editar cartão" onClick={() => setCartaoEditandoAberto(true)}>
            <PencilSquareIcon className="h-4 w-4" />
          </IconButton>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-foreground-secondary">Fatura atual</p>
            <BadgesFatura fatura={resumo.faturaAtual} />
          </div>
          <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">{brl(resumo.faturaAtualCentavos)}</p>
          {resumo.faturaAtual && (
            <p className="text-xs text-foreground-muted">
              Fecha {diaMes(resumo.faturaAtual.fechamento)} · vence {diaMes(resumo.faturaAtual.vencimento)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Indicador rotulo="Dívida total" valor={brl(resumo.dividaCentavos)} />
          <Indicador rotulo="Próximas parcelas" valor={brl(resumo.proximasParcelasCentavos)} />
          <Indicador rotulo="Limite disponível" valor={brl(resumo.limiteDisponivelCentavos)} detalhe={`de ${formatadorMoeda.format(cartao.limiteTotal)}`} />
          <Indicador rotulo="Gastos no cartão este mês" valor={brl(gastosDoMes)} />
        </div>

        {resumo.faturasAPagar.map((f) => (
          <div key={f.competencia} className="rounded-xl border border-border p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">Fatura de {nomeFatura(f.competencia, cartao)}</p>
                <BadgesFatura fatura={f} />
              </div>
              <p className="text-xs text-foreground-muted tabular-nums">
                Falta {brl(f.restanteCentavos)} · vence {diaMes(f.vencimento)}
              </p>
            </div>
            <Button size="sm" onClick={() => setPagamentoDialogo({ competencia: f.competencia })}>
              Pagar
            </Button>
          </div>
        ))}
      </div>

      <SegmentGroup.Root value={aba} onValueChange={(details) => setAba(details.value)} className="p-1 rounded-full bg-surface-hover">
        <SegmentGroup.Indicator className="rounded-full bg-surface-raised dark:bg-surface-active shadow-sm" />
        {[
          { valor: 'extrato', texto: 'Faturas' },
          { valor: 'compras', texto: 'Compras' },
          { valor: 'assinaturas', texto: 'Assinaturas' },
        ].map((item) => (
          <SegmentGroup.Item key={item.valor} value={item.valor}>
            <SegmentGroup.ItemText
              className={`focus-ring cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                aba === item.valor ? 'text-foreground' : 'text-foreground-muted'
              }`}
            >
              {item.texto}
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>

      {aba === 'assinaturas' ? (
        <SubscriptionsTab
          assinaturas={assinaturasDoCartao}
          indisponivel={assinaturasIndisponiveis}
          onNova={() => setAssinaturaDialogo({ modo: 'criar' })}
          onAbrir={(id) => setAssinaturaDialogo({ modo: 'menu', id })}
        />
      ) : aba === 'compras' ? (
        <CardPurchasesTab
          comprasDoCartao={comprasDoCartao}
          onEditarCompra={setCompraEditando}
          onAdicionarCompra={() => setNovaCompraAberta(true)}
          onAdicionarAssinatura={assinaturasIndisponiveis ? undefined : () => setAssinaturaDialogo({ modo: 'criar' })}
          excluirCompra={excluirCompra}
          excluirVariasCompras={excluirVariasCompras}
        />
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {competencias.map((c) => (
              <button
                key={c}
                ref={c === aberta ? pillAtivaRef : undefined}
                type="button"
                onClick={() => setCompetenciaSelecionada(c)}
                className={`focus-ring cursor-pointer shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  c === competenciaSelecionada
                    ? 'bg-surface-active text-foreground border-border-strong'
                    : 'bg-surface-raised text-foreground-secondary border-border hover:bg-surface-hover'
                }`}
              >
                {nomeFatura(c, cartao).slice(0, 3)}
              </button>
            ))}
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  Fatura de {nomeFatura(competenciaSelecionada, cartao)}
                </h2>
                {faturaSelecionada && (
                  <p className="text-xs text-foreground-muted">
                    Fecha {diaMes(faturaSelecionada.fechamento)} · vence {diaMes(faturaSelecionada.vencimento)}
                  </p>
                )}
              </div>
              <BadgesFatura fatura={faturaSelecionada} />
            </div>

            {!faturaSelecionada ? (
              <EmptyState icone={InboxIcon} titulo="Nada nesta fatura" descricao="Nenhuma parcela de cartão cai nesta fatura." />
            ) : (
              <>
                <div className="rounded-2xl border border-border bg-surface-raised p-2 divide-y divide-border">
                  {faturaSelecionada.parcelas.map((p) => (
                    <ParcelaRow
                      key={p.id}
                      parcela={p}
                      ehAssinatura={comprasCartao.find((c) => c.id === p.compraCartaoId)?.origem === 'assinatura'}
                      onEditarCompra={() => abrirEditarCompraPorId(p.compraCartaoId)}
                      onExcluirCompra={() => excluirCompraPorId(p.compraCartaoId)}
                    />
                  ))}
                </div>

                <div className="px-1 pt-1 space-y-1 text-sm tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Total da fatura</span>
                    <span className="font-semibold text-foreground">{brl(faturaSelecionada.totalCentavos)}</span>
                  </div>
                  {faturaSelecionada.pagoCentavos > 0 && (
                    <div className="flex justify-between">
                      <span className="text-foreground-secondary">Pago</span>
                      <span className="text-foreground">{brl(faturaSelecionada.pagoCentavos)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Restante</span>
                    <span className="font-semibold text-foreground">{brl(faturaSelecionada.restanteCentavos)}</span>
                  </div>
                </div>

                {faturaSelecionada.restanteCentavos > 0 && (
                  <Button className="w-full" onClick={() => setPagamentoDialogo({ competencia: competenciaSelecionada })}>
                    Pagar fatura
                  </Button>
                )}
              </>
            )}

            {pagamentosDaCompetencia.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted px-1">Pagamentos registrados</h3>
                <div className="rounded-2xl border border-border bg-surface-raised p-2 divide-y divide-border">
                  {pagamentosDaCompetencia.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{new Date(paraTimestamp(p.data)).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-foreground">{formatadorMoeda.format(p.valor)}</p>
                      <IconButton aria-label="Editar pagamento" onClick={() => setPagamentoDialogo({ competencia: p.competencia, pagamento: p })}>
                        <PencilSquareIcon className="h-5 w-5" />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <ResponsiveDialog aberto={cartaoEditandoAberto} aoFechar={() => setCartaoEditandoAberto(false)}>
        <PaymentCardForm
          cartaoParaEditar={cartao}
          comprometido={cartao.divida}
          onVoltar={() => setCartaoEditandoAberto(false)}
          onCartaoSalvo={handleCartaoSalvo}
          onEditado={() => setCartaoEditandoAberto(false)}
          excluirCartao={excluirCartao}
          onExcluido={() => {
            setCartaoEditandoAberto(false);
            onVoltar();
          }}
        />
      </ResponsiveDialog>

      <ResponsiveDialog aberto={!!compraEditando} aoFechar={() => setCompraEditando(null)}>
        {compraEditando && (
          <PurchaseDetails
            compra={compraEditando}
            cartao={cartao}
            regras={regrasCompra(compraEditando)}
            validarAlteracaoCompras={validarAlteracaoCompras}
            onVoltar={() => setCompraEditando(null)}
            onCompraAtualizada={handleCompraAtualizada}
            onExcluido={() => setCompraEditando(null)}
            excluirCompra={excluirCompra}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog aberto={assinaturaDialogo?.modo === 'criar'} aoFechar={() => setAssinaturaDialogo(null)}>
        {assinaturaDialogo?.modo === 'criar' && (
          <SubscriptionForm
            cartao={cartao}
            onVoltar={() => setAssinaturaDialogo(null)}
            onSalvar={async (dados) => {
              const ok = await criarAssinaturaCartao({ ...dados, cartaoId });
              if (ok) setAssinaturaDialogo(null);
              return ok;
            }}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog aberto={assinaturaDialogo?.modo === 'menu' && !!assinaturaSelecionada} aoFechar={() => setAssinaturaDialogo(null)}>
        {assinaturaDialogo?.modo === 'menu' && assinaturaSelecionada && (
          <SubscriptionActions
            key={assinaturaSelecionada.id}
            assinatura={assinaturaSelecionada}
            cartaoNome={cartao.nome}
            podeExcluir={podeExcluirAssinaturaCartao(assinaturaSelecionada)}
            onEditar={(a) => setAssinaturaDialogo({ modo: 'editar', id: a.id })}
            onCancelar={cancelarAssinaturaCartao}
            onExcluir={excluirAssinaturaCartao}
            onFechar={() => setAssinaturaDialogo(null)}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog aberto={assinaturaDialogo?.modo === 'editar' && !!assinaturaSelecionada} aoFechar={() => setAssinaturaDialogo(null)}>
        {assinaturaDialogo?.modo === 'editar' && assinaturaSelecionada && (
          <SubscriptionForm
            cartao={cartao}
            assinaturaParaEditar={assinaturaSelecionada}
            onVoltar={() => setAssinaturaDialogo(null)}
            onSalvar={async (dados) => {
              const ok = await editarAssinaturaCartao(assinaturaSelecionada, dados);
              if (ok) setAssinaturaDialogo(null);
              return ok;
            }}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog aberto={novaCompraAberta} aoFechar={() => setNovaCompraAberta(false)}>
        {novaCompraAberta && (
          <TransactionFlow
            tipoInicial="despesa"
            cartaoForcado={cartao}
            cartoes={cartoes}
            onFechar={() => setNovaCompraAberta(false)}
            onTransacaoSalva={() => {}}
            onCompraCartaoSalva={handleCompraCriada}
          />
        )}
      </ResponsiveDialog>

      <ResponsiveDialog aberto={!!dialogo} aoFechar={() => setPagamentoDialogo(null)}>
        {dialogo && (
          <InvoicePaymentDialog
            cartao={cartao}
            competencia={pagamentoDialogo.competencia}
            restanteFaturaCentavos={dialogo.restanteFaturaCentavos}
            maximoCentavos={dialogo.maximoCentavos}
            saldoFinanceiro={saldoFinanceiro}
            saldoDisponivel={saldoDisponivel}
            pagamentoParaEditar={pagamentoDialogo.pagamento}
            onSalvo={handlePagamentoSalvo}
            onExcluir={excluirTransacao}
            onFechar={() => setPagamentoDialogo(null)}
          />
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default CartaoDetalhe;
