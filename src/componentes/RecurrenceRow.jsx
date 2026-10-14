import React from 'react';
import { ArrowPathIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Linha de SÉRIE (a regra que gera as contas) — gestão secundária: compacta, neutra, sem ações
// inline. Tocar abre a sheet com Editar / Encerrar / Excluir (RecurrenceActions).
const RecurrenceRow = ({ descricao, valor, tipo, diaDoMes, encerrada = false, onClick }) => {
  const detalhe = [tipo === 'receita' ? 'Receita' : null, formatadorMoeda.format(valor), 'mensal', `dia ${diaDoMes}`, encerrada ? 'encerrada' : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring cursor-pointer w-[calc(100%+1rem)] min-h-14 flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl text-left hover:bg-surface-hover ${encerrada ? 'opacity-60' : ''}`}
    >
      <span className="h-8 w-8 rounded-full bg-surface-hover text-foreground-muted flex items-center justify-center shrink-0">
        <ArrowPathIcon className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-foreground truncate">{descricao}</span>
        <span className="block text-xs text-foreground-muted truncate">{detalhe}</span>
      </span>
      <ChevronRightIcon className="h-4 w-4 text-foreground-muted shrink-0" />
    </button>
  );
};

export default RecurrenceRow;
