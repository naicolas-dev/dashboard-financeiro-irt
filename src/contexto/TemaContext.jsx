import { createContext, useContext, useEffect, useState } from 'react';

const TemaContext = createContext();

export function TemaProvider({ children }) {
  const [temaEscuro, setTemaEscuro] = useState(false);

  // Sincronizar classe dark ANTES de montar
  useEffect(() => {
    const salvo = localStorage.getItem('temaEscuro');
    const valorInicial = salvo ? JSON.parse(salvo) : false;

    setTemaEscuro(valorInicial);

    if (valorInicial) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Atualiza quando usuário alterna via botão
  useEffect(() => {
    localStorage.setItem('temaEscuro', JSON.stringify(temaEscuro));
    if (temaEscuro) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [temaEscuro]);

  return (
    <TemaContext.Provider value={{ temaEscuro, setTemaEscuro }}>
      {children}
    </TemaContext.Provider>
  );
}

export function useTema() {
  return useContext(TemaContext);
}
