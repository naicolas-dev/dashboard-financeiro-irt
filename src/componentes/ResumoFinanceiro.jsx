import React, { useMemo } from 'react';
import { ArrowUpCircleIcon, ArrowDownCircleIcon, ScaleIcon } from '@heroicons/react/24/outline';

const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

function ResumoFinanceiro({ transacoes }) {
  const { receitas, despesas, saldo } = useMemo(() => {
    const receitas = transacoes.filter((t) => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
    const despesas = transacoes.filter((t) => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0);
    return { receitas, despesas, saldo: receitas - despesas };
  }, [transacoes]);

  const cardStyles =
    "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-lg shadow-sm flex items-center space-x-4";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className={cardStyles}>
        <ArrowUpCircleIcon className="h-12 w-12 text-emerald-500" aria-label="Ícone de receitas" />
        <div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total de Receitas</h3>
          <p className="text-2xl font-bold text-emerald-600">{formatarMoeda(receitas)}</p>
        </div>
      </div>

      <div className={cardStyles}>
        <ArrowDownCircleIcon className="h-12 w-12 text-rose-500" aria-label="Ícone de despesas" />
        <div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total de Despesas</h3>
          <p className="text-2xl font-bold text-rose-600">{formatarMoeda(despesas)}</p>
        </div>
      </div>

      <div className={cardStyles}>
        <ScaleIcon className="h-12 w-12 text-indigo-500" aria-label="Ícone de saldo" />
        <div>
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Saldo Atual</h3>
          <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {formatarMoeda(saldo)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResumoFinanceiro;
