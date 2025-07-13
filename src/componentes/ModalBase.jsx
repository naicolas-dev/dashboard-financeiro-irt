// componentes/ModalBase.jsx
import React, { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const ModalBase = ({ aberto, aoFechar, children, larguraMaxima = 'max-w-md' }) => {
  const [exibir, setExibir] = useState(false);
  const [animar, setAnimar] = useState(false);

  useEffect(() => {
    if (aberto) {
      setExibir(true);
      setTimeout(() => setAnimar(true), 10);
    } else {
      setAnimar(false);
      setTimeout(() => setExibir(false), 300);
    }
  }, [aberto]);

  if (!exibir) return null;

  return (
    <div
      onClick={aoFechar}
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300
        backdrop-blur-sm ${animar ? 'opacity-100 bg-black/30 dark:bg-black/60' : 'opacity-0 bg-black/0'}
      `}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          relative w-[95%] sm:w-full ${larguraMaxima}
          bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
          rounded-lg shadow-lg overflow-y-auto
          max-h-screen transition-all duration-300 transform ease-in-out
          ${animar ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        `}
      >
        {/* Botão de fechar */}
        <button
          onClick={aoFechar}
          className="cursor-pointer absolute top-3 right-3 text-slate-400 hover:text-red-500 z-10"
          aria-label="Fechar modal"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        <div className="p-4 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ModalBase;
