import React from 'react';
import { OPCOES_PARCELAS, rotuloParcelas } from '../servicos/cartoes.js';

// Etapa 'selecionar-parcelas' do TransactionFlow — À vista (1) até 48x.
const InstallmentsPicker = ({ numeroParcelas, onSelecionar, onVoltar }) => {
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
        <p className="text-sm font-semibold text-foreground">Parcelas</p>
        <div className="w-12" aria-hidden="true" />
      </div>

      <div className="max-h-[60vh] overflow-y-auto space-y-1">
        {OPCOES_PARCELAS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSelecionar(n)}
            className={`focus-ring cursor-pointer w-full text-left px-4 py-3 rounded-xl ${
              n === numeroParcelas ? 'bg-surface-active text-foreground font-semibold' : 'hover:bg-surface-hover text-foreground'
            }`}
          >
            {rotuloParcelas(n)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InstallmentsPicker;
