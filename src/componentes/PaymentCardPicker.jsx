import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import Button from './ui/Button';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Etapa 'selecionar-cartao' do TransactionFlow — voltar sempre retorna pra 'detalhes'
// sem descartar nada da despesa em andamento (quem decide isso é o TransactionFlow,
// este componente só emite os eventos).
const PaymentCardPicker = ({ cartoes, onSelecionar, onNovoCartao, onVoltar }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={onVoltar}
          className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 rounded-lg"
        >
          Voltar
        </button>
        <p className="text-sm font-semibold text-foreground">Selecione um cartão</p>
        <div className="w-12" aria-hidden="true" />
      </div>

      {cartoes.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-sm text-foreground-secondary">Nenhum cartão cadastrado</p>
          <Button onClick={onNovoCartao}>Adicionar cartão</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {cartoes.map((cartao) => (
            <button
              key={cartao.id}
              type="button"
              onClick={() => onSelecionar(cartao.id)}
              className="focus-ring cursor-pointer w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-surface hover:bg-surface-hover text-left"
            >
              <span className="font-medium text-foreground">{cartao.nome}</span>
              <span className="text-sm text-foreground-muted tabular-nums shrink-0">
                Disponível {formatadorMoeda.format(cartao.limiteDisponivel)}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={onNovoCartao}
            className="focus-ring cursor-pointer w-full flex items-center gap-2 p-4 rounded-xl text-foreground hover:bg-surface-hover"
          >
            <PlusIcon className="h-5 w-5" />
            <span className="font-medium">Adicionar cartão</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentCardPicker;
