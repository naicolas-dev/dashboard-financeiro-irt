import { createContext, useContext, useEffect, useState } from 'react';

const TemaContext = createContext();

function lerTemaSalvo() {
  try {
    const salvo = localStorage.getItem('temaEscuro');
    return salvo ? JSON.parse(salvo) : false;
  } catch {
    return false;
  }
}

export function TemaProvider({ children }) {
  // Inicializa já lendo o valor salvo (síncrono, no primeiro render) — dois
  // useEffect separados (um de leitura, um de escrita) competiam entre si e
  // faziam o tema salvo se perder a cada reload (o de escrita rodava com o
  // valor antigo antes do de leitura terminar de aplicar o valor correto).
  const [temaEscuro, setTemaEscuro] = useState(lerTemaSalvo);

  useEffect(() => {
    localStorage.setItem('temaEscuro', JSON.stringify(temaEscuro));
    document.documentElement.classList.toggle('dark', temaEscuro);
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
