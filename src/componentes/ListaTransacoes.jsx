import React from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function ListaTransacoes({ transacoes, carregando, onSelecionarParaEditar, onExcluir }) {
  if (carregando) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
        Carregando...
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-100">Histórico de Transações</h2>
      </div>

      {transacoes.length === 0 ? (
        <p className="text-center text-slate-500 dark:text-slate-400 py-8">
          Nenhum lançamento encontrado para os filtros selecionados.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {transacoes.map((t) => {
            const ehReceita = t.tipo === 'receita';
            const valorFormatado = formatadorMoeda.format(t.valor);
            const dataFormatada = new Date(t.data).toLocaleString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <li
                key={t.id}
                className="flex items-start justify-between gap-4 p-4 group hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 truncate" title={t.descricao}>
                    {t.descricao}
                  </p>
                  <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 mt-1 flex-wrap gap-1">
                    <span>{t.categoria}</span>
                    <span className="mx-2">|</span>
                    <span className="text-xs">{dataFormatada}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className={`font-bold text-base ${ehReceita ? 'text-green-600' : 'text-red-600'}`}>
                    {valorFormatado}
                  </span>

                  <div className="flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onSelecionarParaEditar(t)}
                      className="p-2 rounded-full text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 min-w-[44px] min-h-[44px]"
                      aria-label="Editar transação"
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onExcluir(t.id)}
                      className="p-2 rounded-full text-slate-400 hover:text-red-600 dark:hover:text-red-400 min-w-[44px] min-h-[44px]"
                      aria-label="Excluir transação"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ListaTransacoes;
