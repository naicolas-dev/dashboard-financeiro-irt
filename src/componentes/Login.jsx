import React, { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexto/AuthContext';
import Button from './ui/Button';

// Só a casca visual mudou aqui (tokens, Button novo) — login()/sessão/cookie/
// custom token continuam exatamente como antes.
const Login = () => {
  const { login } = useAuth();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!senha || enviando) return;

    setErro('');
    setEnviando(true);
    try {
      await login(senha);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setErro('Senha incorreta. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="flex items-center justify-center min-h-dvh bg-background px-4">
      <section className="p-8 bg-surface-raised border border-border rounded-2xl shadow-sm w-full max-w-sm space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">Bem-vindo de volta</h1>
          <p className="text-foreground-secondary text-sm">Informe a senha para acessar suas finanças.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label htmlFor="senha" className="sr-only">
              Senha
            </label>
            <input
              id="senha"
              type={mostrarSenha ? 'text' : 'password'}
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              className="focus-ring w-full h-11 pl-3.5 pr-11 rounded-xl bg-surface-raised text-foreground placeholder:text-foreground-muted border border-border outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((atual) => !atual)}
              className="focus-ring cursor-pointer absolute inset-y-0 right-0 flex items-center px-3 rounded-xl text-foreground-muted hover:text-foreground-secondary"
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              tabIndex={-1}
            >
              {mostrarSenha ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>

          {erro && (
            <p className="text-sm text-negative" role="alert">
              {erro}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={enviando || !senha}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </section>
    </main>
  );
};

export default Login;
