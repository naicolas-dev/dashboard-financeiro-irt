import React from 'react';
import { ArrowPathIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import IconButton from './ui/IconButton';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Mesmo padrão visual/estrutural do TransactionRow (ícone + texto + valor + botões
// de editar/excluir) — linha de regra recorrente, não de transação já lançada.
const RecurrenceRow = ({ descricao, valor, tipo, diaDoMes, onEditar, onExcluir }) => {
  const ehReceita = tipo === 'receita';

  return (
    <div className="flex items-center gap-1 py-1 px-2 -mx-2 rounded-xl">
      <div className="flex-1 flex items-center gap-3 min-w-0 py-2">
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            ehReceita ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
          }`}
        >
          <ArrowPathIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{descricao}</p>
          <p className="text-xs text-foreground-muted">Todo dia {diaDoMes}</p>
        </div>
        <p className={`font-semibold tabular-nums shrink-0 ${ehReceita ? 'text-positive' : 'text-negative'}`}>
          {formatadorMoeda.format(valor)}
        </p>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <IconButton aria-label={`Editar ${descricao}`} onClick={onEditar}>
          <PencilSquareIcon className="h-5 w-5" />
        </IconButton>
        <IconButton aria-label={`Excluir ${descricao}`} variant="danger" onClick={onExcluir}>
          <TrashIcon className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  );
};

export default RecurrenceRow;
