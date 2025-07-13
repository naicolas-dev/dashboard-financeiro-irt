import React, { createContext, useState, useEffect, useContext } from 'react';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithCredential } from 'firebase/auth';
import { app } from '../firebase/configuracao'; // Seu arquivo de configuração do Firebase

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const auth = getAuth(app);

  useEffect(() => {
    // Listener que observa mudanças no estado de autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setCarregando(false);
      
      // ===================================================================
      // ================ NOVA LÓGICA DE COMUNICAÇÃO =======================
      // Verifica se está rodando dentro do nosso WebView nativo
      if (window.ReactNativeWebView) {
        if (user) {
          // Se o usuário existe (logou), envia uma mensagem para o app nativo
          window.ReactNativeWebView.postMessage('USER_LOGGED_IN');
        } else {
          // Se o usuário não existe (deslogou), envia outra mensagem
          window.ReactNativeWebView.postMessage('USER_LOGGED_OUT');
        }
      }
      // ===================================================================
    });

    // Função para lidar com o token recebido do app nativo
    const handleTokenFromNative = async (event) => {
      console.log("Token recebido do app nativo!");
      const { token } = event.detail;

      if (token) {
        setCarregando(true);
        try {
          // Cria a credencial do Google a partir do token
          const credential = GoogleAuthProvider.credential(token);
          // Faz o login no Firebase com a credencial
          await signInWithCredential(auth, credential);
        } catch (error) {
          console.error("Erro ao autenticar com a credencial nativa:", error);
          setCarregando(false); 
        }
      }
    };

    // Adiciona o listener para o evento customizado que o app nativo vai disparar
    window.addEventListener('firebaseAuthTokenReceived', handleTokenFromNative);

    // Função de limpeza que é executada quando o componente é desmontado
    return () => {
      unsubscribe(); // Limpa o listener de autenticação
      window.removeEventListener('firebaseAuthTokenReceived', handleTokenFromNative); // Limpa o listener do token
    };
  }, [auth]);

  // Este método continuará funcionando para login via navegador web
  const loginComGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const logout = () => {
    return signOut(auth);
  };

  const value = {
    usuario,
    carregando,
    loginComGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!carregando && children}
    </AuthContext.Provider>
  );
}
