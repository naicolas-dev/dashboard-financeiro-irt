import React, { useState, useMemo } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import CreditCardTile from '../componentes/CreditCardTile.jsx';
import PaymentCardForm from '../componentes/PaymentCardForm.jsx';
import ResponsiveDialog from '../componentes/ui/ResponsiveDialog.jsx';
import Skeleton from '../componentes/ui/Skeleton.jsx';
import CartaoDetalhe from './CartaoDetalhe.jsx';
import { competenciaAtual } from '../servicos/cartoes.js';

function CartoesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Skeleton className="h-48 w-full rounded-[20px]" />
      <Skeleton className="h-48 w-full rounded-[20px]" />
    </div>
  );
}

// Tile pontilhado que fica sempre na próxima posição livre da grade (depois do
// último cartão, ou sozinho quando não há nenhum) — substitui o botão "Novo cartão"
// solto no cabeçalho.
function AdicionarCartaoTile({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring cursor-pointer rounded-[20px] border-2 border-dashed border-border-strong min-h-48 flex flex-col items-center justify-center gap-2 text-foreground-secondary hover:border-foreground-muted hover:text-foreground hover:bg-surface transition-colors"
    >
      <PlusIcon className="h-6 w-6" />
      <span className="text-sm font-medium">Adicionar cartão</span>
    </button>
  );
}

// Lista de cartões (CreditCardTile já existente, Design Lab) + navegação pro
// detalhe/extrato. `faturaAtual` vem de `parcelasCartao` (não de `transacoes`) —
// é a leitura completa, sem o recorte de 12 meses do fluxo de caixa, então não perde
// parcela nenhuma do mês mesmo que a data dela ainda não tenha "acontecido".
const Cartoes = ({
  cartoes,
  comprasCartao,
  parcelasCartao,
  carregando,
  handleCartaoSalvo,
  handleCompraCriada,
  excluirCartao,
  excluirCompra,
  excluirVariasCompras,
  handleCompraAtualizada,
}) => {
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = useState(null);
  const [novoCartaoAberto, setNovoCartaoAberto] = useState(false);
  const [cartaoEditando, setCartaoEditando] = useState(null);

  const faturaAtualPorCartao = useMemo(() => {
    const atual = competenciaAtual();
    const mapa = {};
    for (const parcela of parcelasCartao) {
      if (parcela.competencia !== atual) continue;
      mapa[parcela.cartaoId] = (mapa[parcela.cartaoId] || 0) + parcela.valor;
    }
    return mapa;
  }, [parcelasCartao]);

  if (cartaoSelecionadoId) {
    return (
      <CartaoDetalhe
        cartaoId={cartaoSelecionadoId}
        cartoes={cartoes}
        comprasCartao={comprasCartao}
        parcelasCartao={parcelasCartao}
        onVoltar={() => setCartaoSelecionadoId(null)}
        handleCartaoSalvo={handleCartaoSalvo}
        handleCompraCriada={handleCompraCriada}
        excluirCartao={excluirCartao}
        excluirCompra={excluirCompra}
        excluirVariasCompras={excluirVariasCompras}
        handleCompraAtualizada={handleCompraAtualizada}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Cartões</h1>
        {!carregando && cartoes.length === 0 && (
          <p className="text-sm text-foreground-secondary mt-1">
            Nenhum cartão cadastrado. Toque em "Adicionar cartão" para começar.
          </p>
        )}
      </div>

      {carregando ? (
        <CartoesSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cartoes.map((cartao) => (
            <CreditCardTile
              key={cartao.id}
              banco={cartao.nome}
              bandeira={cartao.bandeira}
              faturaAtual={faturaAtualPorCartao[cartao.id] || 0}
              limiteDisponivel={cartao.limiteDisponivel}
              limiteTotal={cartao.limiteTotal}
              fechamento={cartao.diaFechamento}
              vencimento={cartao.diaVencimento}
              tema={cartao.tema}
              onAbrir={() => setCartaoSelecionadoId(cartao.id)}
              onEditar={() => setCartaoEditando(cartao)}
              onExcluir={() => excluirCartao(cartao)}
            />
          ))}
          <AdicionarCartaoTile onClick={() => setNovoCartaoAberto(true)} />
        </div>
      )}

      <ResponsiveDialog aberto={novoCartaoAberto} aoFechar={() => setNovoCartaoAberto(false)}>
        <PaymentCardForm
          onVoltar={() => setNovoCartaoAberto(false)}
          onCartaoSalvo={handleCartaoSalvo}
          onCriado={() => setNovoCartaoAberto(false)}
        />
      </ResponsiveDialog>

      <ResponsiveDialog aberto={!!cartaoEditando} aoFechar={() => setCartaoEditando(null)}>
        {cartaoEditando && (
          <PaymentCardForm
            cartaoParaEditar={cartaoEditando}
            comprometido={cartaoEditando.limiteTotal - cartaoEditando.limiteDisponivel}
            onVoltar={() => setCartaoEditando(null)}
            onCartaoSalvo={handleCartaoSalvo}
            onEditado={() => setCartaoEditando(null)}
            excluirCartao={excluirCartao}
            onExcluido={() => setCartaoEditando(null)}
          />
        )}
      </ResponsiveDialog>
    </div>
  );
};

export default Cartoes;
