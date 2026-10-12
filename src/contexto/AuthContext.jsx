import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { getAuth, onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { app } from '../firebase/configuracao';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

async function requisicaoJson(url, opcoes) {
  const resposta = await fetch(url, { credentials: 'include', ...opcoes });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Falha na requisição.');
  }
  return dados;
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const auth = getAuth(app);

  const notificarAppNativo = useCallback((logado) => {
    // Sinal usado por um app nativo (WebView) que embrulha este site.
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(logado ? 'USER_LOGGED_IN' : 'USER_LOGGED_OUT');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      notificarAppNativo(!!user);
    });
    return unsubscribe;
  }, [auth, notificarAppNativo]);

  useEffect(() => {
    let ativo = true;

    const restaurarSessao = async () => {
      try {
        const { autenticado } = await requisicaoJson('/api/sessao');
        if (!autenticado) return;

        const { firebaseToken } = await requisicaoJson('/api/firebase-token');
        await signInWithCustomToken(auth, firebaseToken);
      } catch (erro) {
        console.error('Não foi possível restaurar a sessão:', erro);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    restaurarSessao();
    return () => {
      ativo = false;
    };
  }, [auth]);

  const login = useCallback(
    async (senha) => {
      const { firebaseToken } = await requisicaoJson('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      await signInWithCustomToken(auth, firebaseToken);
    },
    [auth]
  );

  const logout = useCallback(async () => {
    try {
      await requisicaoJson('/api/logout', { method: 'POST' });
    } finally {
      await signOut(auth);
    }
  }, [auth]);

  const value = { usuario, carregando, login, logout };

  return <AuthContext.Provider value={value}>{!carregando && children}</AuthContext.Provider>;
}
