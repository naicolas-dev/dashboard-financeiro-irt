import React from 'react';

function PainelBase({ titulo, botaoAcao = null, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
      {(titulo || botaoAcao) && (
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-100">{titulo}</h2>
          {botaoAcao && <div className="shrink-0">{botaoAcao}</div>}
        </div>
      )}
      {/* Conteúdo sem padding extra. Cada painel define o seu */}
      {children}
    </div>
  );
}

export default PainelBase;
