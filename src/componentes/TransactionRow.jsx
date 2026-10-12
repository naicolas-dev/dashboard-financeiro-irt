import React from 'react';
import { ArrowUpRightIcon, ArrowDownRightIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import IconButton from './ui/IconButton';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Com `onEditar`/`onExcluir` (Movimentações): linha não é mais um único botão —
// vira um contêiner com dois botões-ferramenta explícitos ao lado (editar/excluir),
// porque depender do toque na linha inteira pra abrir um fluxo de edição de várias
// etapas só pra excluir, por exemplo, é lento. Sem esses props (Home, lista "últimas
// transações"), continua só uma linha estática — comportamento inalterado.
const TransactionRow = ({ descricao, categoria, dataFormatada, valor, tipo, onClick, onEditar, onExcluir }) => {
  const ehReceita = tipo === 'receita';
  const temAcoes = Boolean(onEditar || onExcluir);

  const conteudo = (
    <>
      <div
        className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
          ehReceita ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
        }`}
      >
        {ehReceita ? <ArrowUpRightIcon className="h-5 w-5" /> : <ArrowDownRightIcon className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{descricao}</p>
        <p className="text-xs text-foreground-muted">
          {categoria} · {dataFormatada}
        </p>
      </div>
      <p className={`font-semibold tabular-nums shrink-0 ${ehReceita ? 'text-positive' : 'text-negative'}`}>
        {ehReceita ? '+' : '-'} {formatadorMoeda.format(Math.abs(valor))}
      </p>
    </>
  );

  if (!temAcoes) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="focus-ring cursor-pointer w-full flex items-center gap-3 py-3 px-2 -mx-2 rounded-xl text-left hover:bg-surface-hover"
      >
        {conteudo}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 py-1 px-2 -mx-2 rounded-xl">
      <div className="flex-1 flex items-center gap-3 min-w-0 py-2">{conteudo}</div>
      <div className="flex items-center gap-0.5 shrink-0">
        {onEditar && (
          <IconButton aria-label={`Editar ${descricao}`} onClick={onEditar}>
            <PencilSquareIcon className="h-5 w-5" />
          </IconButton>
        )}
        {onExcluir && (
          <IconButton aria-label={`Excluir ${descricao}`} variant="danger" onClick={onExcluir}>
            <TrashIcon className="h-5 w-5" />
          </IconButton>
        )}
      </div>
    </div>
  );
};

export default TransactionRow;
