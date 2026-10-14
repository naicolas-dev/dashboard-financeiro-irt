import React, { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import CreditCardTile from '../componentes/CreditCardTile.jsx';
import PaymentCardForm from '../componentes/PaymentCardForm.jsx';
import ResponsiveDialog from '../componentes/ui/ResponsiveDialog.jsx';
import Skeleton from '../componentes/ui/Skeleton.jsx';
import CartaoDetalhe from './CartaoDetalhe.jsx';

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

// Lista de cartões + navegação pro detalhe. Fatura atual, dívida e limite vêm de
// `cartao.resumo` (derivado pelo domínio a partir de compras + pagamentos).
const Cartoes = ({
  cartoes,
  comprasCartao,
  pagamentosFatura,
  saldoFinanceiro,
  saldoDisponivel,
  carregando,
  erroCarregamento,
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
  const [cartaoSelecionadoId, setCartaoSelecionadoId] = useState(null);
  const [novoCartaoAberto, setNovoCartaoAberto] = useState(false);
  const [cartaoEditando, setCartaoEditando] = useState(null);

  if (cartaoSelecionadoId) {
    return (
      <CartaoDetalhe
        cartaoId={cartaoSelecionadoId}
        cartoes={cartoes}
        comprasCartao={comprasCartao}
        pagamentosFatura={pagamentosFatura}
        saldoFinanceiro={saldoFinanceiro}
        saldoDisponivel={saldoDisponivel}
        onVoltar={() => setCartaoSelecionadoId(null)}
        handleCartaoSalvo={handleCartaoSalvo}
        handleCompraCriada={handleCompraCriada}
        handlePagamentoSalvo={handlePagamentoSalvo}
        excluirCartao={excluirCartao}
        excluirCompra={excluirCompra}
        excluirVariasCompras={excluirVariasCompras}
        excluirTransacao={excluirTransacao}
        handleCompraAtualizada={handleCompraAtualizada}
        regrasCompra={regrasCompra}
        validarAlteracaoCompras={validarAlteracaoCompras}
        contextoPagamento={contextoPagamento}
        assinaturasCartao={assinaturasCartao}
        assinaturasIndisponiveis={assinaturasIndisponiveis}
        criarAssinaturaCartao={criarAssinaturaCartao}
        editarAssinaturaCartao={editarAssinaturaCartao}
        cancelarAssinaturaCartao={cancelarAssinaturaCartao}
        excluirAssinaturaCartao={excluirAssinaturaCartao}
        podeExcluirAssinaturaCartao={podeExcluirAssinaturaCartao}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Cartões</h1>
        {!carregando && cartoes.length === 0 && (
          <p className={`text-sm mt-1 ${erroCarregamento ? 'text-warning' : 'text-foreground-secondary'}`}>
            {erroCarregamento
              ? 'Sem conexão — não foi possível carregar seus cartões.'
              : 'Nenhum cartão cadastrado. Toque em "Adicionar cartão" para começar.'}
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
              faturaAtual={cartao.resumo.faturaAtualCentavos / 100}
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
            comprometido={cartaoEditando.divida}
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
