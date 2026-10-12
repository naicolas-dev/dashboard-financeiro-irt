import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SegmentGroup } from '@chakra-ui/react';
import { InboxIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import EmptyState from '../componentes/ui/EmptyState.jsx';
import IconButton from '../componentes/ui/IconButton.jsx';
import ResponsiveDialog from '../componentes/ui/ResponsiveDialog.jsx';
import Badge from '../componentes/ui/Badge.jsx';
import PaymentCardForm from '../componentes/PaymentCardForm.jsx';
import PurchaseDetails from '../componentes/PurchaseDetails.jsx';
import CardPurchasesTab from '../componentes/CardPurchasesTab.jsx';
import TransactionFlow from '../componentes/TransactionFlow.jsx';
import { competenciaAtual, adicionarMesesCompetencia, nomeCompetencia } from '../servicos/cartoes.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Ícones operam sobre a COMPRA-PAI (via compraCartaoId), não sobre a parcela isolada
// — editar/excluir aqui editam/excluem a compra inteira, repetido em cada parcela
// exibida por conveniência (o usuário pode estar olhando qualquer competência).
const ParcelaRow = ({ parcela, onEditarCompra, onExcluirCompra }) => {
  const ehParcelada = parcela.totalParcelas > 1;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{parcela.descricao}</p>
        <p className="text-xs text-foreground-muted">
          {parcela.categoria} · {ehParcelada ? `Parcela ${parcela.parcelaAtual}/${parcela.totalParcelas}` : 'À vista'}
        </p>
        {ehParcelada && (
          <p className="text-xs text-foreground-muted">Total da compra: {formatadorMoeda.format(parcela.valorTotalCompra)}</p>
        )}
      </div>
      <p className="font-semibold tabular-nums text-foreground shrink-0">{formatadorMoeda.format(parcela.valor)}</p>
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

// Extrato por competência de um cartão (janela visual -8/atual/+3, domínio completo —
// ver comentário original em `parcelasCartao`) + aba "Compras" (administração: editar/
// excluir compra-pai, seleção múltipla). `comprasCartao`/`parcelasCartao` já vêm
// carregados por inteiro do hook, sem query adicional nesta tela.
const CartaoDetalhe = ({
  cartaoId,
  cartoes,
  comprasCartao,
  parcelasCartao,
  onVoltar,
  handleCartaoSalvo,
  handleCompraCriada,
  excluirCartao,
  excluirCompra,
  excluirVariasCompras,
  handleCompraAtualizada,
}) => {
  const cartao = cartoes.find((c) => c.id === cartaoId);
  const atual = competenciaAtual();
  const pillAtivaRef = useRef(null);

  const competencias = useMemo(() => Array.from({ length: 12 }, (_, i) => adicionarMesesCompetencia(atual, i - 8)), [atual]);
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState(atual);
  const [aba, setAba] = useState('extrato'); // 'extrato' | 'compras'
  const [cartaoEditandoAberto, setCartaoEditandoAberto] = useState(false);
  const [compraEditando, setCompraEditando] = useState(null);
  const [novaCompraAberta, setNovaCompraAberta] = useState(false);

  useEffect(() => {
    pillAtivaRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []);

  const parcelasDoCartao = useMemo(() => parcelasCartao.filter((p) => p.cartaoId === cartaoId), [parcelasCartao, cartaoId]);
  const comprasDoCartao = useMemo(() => comprasCartao.filter((c) => c.cartaoId === cartaoId), [comprasCartao, cartaoId]);

  const faturaAtual = useMemo(
    () => parcelasDoCartao.filter((p) => p.competencia === atual).reduce((acc, p) => acc + p.valor, 0),
    [parcelasDoCartao, atual]
  );

  const parcelasDaCompetencia = useMemo(
    () => parcelasDoCartao.filter((p) => p.competencia === competenciaSelecionada),
    [parcelasDoCartao, competenciaSelecionada]
  );

  const totalCompetencia = parcelasDaCompetencia.reduce((acc, p) => acc + p.valor, 0);
  const ehFutura = competenciaSelecionada > atual;
  const ehAtual = competenciaSelecionada === atual;

  const parcelasDaCompraEditando = useMemo(
    () => (compraEditando ? parcelasCartao.filter((p) => p.compraCartaoId === compraEditando.id) : []),
    [parcelasCartao, compraEditando]
  );

  const abrirEditarCompraPorId = (compraId) => {
    const compra = comprasCartao.find((c) => c.id === compraId);
    if (compra) setCompraEditando(compra);
  };

  const excluirCompraPorId = (compraId) => {
    const compra = comprasCartao.find((c) => c.id === compraId);
    if (compra) excluirCompra(compra);
  };

  if (!cartao) return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onVoltar}
          className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 -ml-2 rounded-lg"
        >
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
          <p className="text-sm text-foreground-secondary">Fatura atual</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">{formatadorMoeda.format(faturaAtual)}</p>
        </div>

        <div>
          <p className="text-sm text-foreground-secondary tabular-nums">
            Limite disponível {formatadorMoeda.format(cartao.limiteDisponivel)} de {formatadorMoeda.format(cartao.limiteTotal)}
          </p>
        </div>
      </div>

      <SegmentGroup.Root value={aba} onValueChange={(details) => setAba(details.value)} className="p-1 rounded-full bg-surface-hover">
        <SegmentGroup.Indicator className="rounded-full bg-surface-raised dark:bg-surface-active shadow-sm" />
        {[
          { valor: 'extrato', texto: 'Extrato' },
          { valor: 'compras', texto: 'Compras' },
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

      {aba === 'compras' ? (
        <CardPurchasesTab
          comprasDoCartao={comprasDoCartao}
          onEditarCompra={setCompraEditando}
          onAdicionarCompra={() => setNovaCompraAberta(true)}
          excluirCompra={excluirCompra}
          excluirVariasCompras={excluirVariasCompras}
        />
      ) : (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {competencias.map((c) => (
              <button
                key={c}
                ref={c === atual ? pillAtivaRef : undefined}
                type="button"
                onClick={() => setCompetenciaSelecionada(c)}
                className={`focus-ring cursor-pointer shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  c === competenciaSelecionada
                    ? 'bg-surface-active text-foreground border-border-strong'
                    : 'bg-surface-raised text-foreground-secondary border-border hover:bg-surface-hover'
                }`}
              >
                {nomeCompetencia(c).slice(0, 3)}
              </button>
            ))}
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                {nomeCompetencia(competenciaSelecionada)}
              </h2>
              {ehFutura && <Badge variant="neutro">Fatura projetada</Badge>}
              {ehAtual && <Badge variant="neutro">Fatura atual</Badge>}
            </div>

            {parcelasDaCompetencia.length === 0 ? (
              <EmptyState icone={InboxIcon} titulo="Nada nessa competência" descricao="Nenhuma parcela de cartão cai neste mês." />
            ) : (
              <div className="rounded-2xl border border-border bg-surface-raised p-2 divide-y divide-border">
                {parcelasDaCompetencia.map((p) => (
                  <ParcelaRow
                    key={p.id}
                    parcela={p}
                    onEditarCompra={() => abrirEditarCompraPorId(p.compraCartaoId)}
                    onExcluirCompra={() => excluirCompraPorId(p.compraCartaoId)}
                  />
                ))}
              </div>
            )}

            {parcelasDaCompetencia.length > 0 && (
              <div className="flex items-center justify-between px-1 pt-1">
                <p className="text-sm font-medium text-foreground-secondary">{ehFutura ? 'Total projetado' : 'Total da fatura'}</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">{formatadorMoeda.format(totalCompetencia)}</p>
              </div>
            )}
          </section>
        </>
      )}

      <ResponsiveDialog aberto={cartaoEditandoAberto} aoFechar={() => setCartaoEditandoAberto(false)}>
        <PaymentCardForm
          cartaoParaEditar={cartao}
          comprometido={cartao.limiteTotal - cartao.limiteDisponivel}
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
            parcelasExistentes={parcelasDaCompraEditando}
            onVoltar={() => setCompraEditando(null)}
            onCompraAtualizada={handleCompraAtualizada}
            onExcluido={() => setCompraEditando(null)}
            excluirCompra={excluirCompra}
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
    </div>
  );
};

export default CartaoDetalhe;
