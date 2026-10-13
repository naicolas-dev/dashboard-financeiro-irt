import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { SunIcon, MoonIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexto/AuthContext.jsx';
import { useTema } from '../contexto/TemaContext.jsx';
import IconButton from './ui/IconButton.jsx';
import BottomNavigation from './BottomNavigation.jsx';
import DesktopNavigation from './DesktopNavigation.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import PWAController from './PWAController.jsx';

// Mesmo corte de breakpoint (1024px) que decide header mobile vs. DesktopNavigation
// flutuante e BottomNavigation — o Toaster segue a mesma divisão pra não colidir
// com nenhum dos dois (top-right no desktop, bottom-center acima da barra no mobile).
function useEhDesktop() {
  const [ehDesktop, setEhDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );

  useEffect(() => {
    const consulta = window.matchMedia('(min-width: 1024px)');
    const aoMudar = (e) => setEhDesktop(e.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  return ehDesktop;
}

// Chrome da aplicação: navegação, tema, logout, toaster. Não conhece dados
// financeiros — `home`/`movimentacoes`/`cartoes` chegam prontos de App.jsx como
// elementos opacos. `activeSection` mora em App.jsx (não aqui) desde que a Home
// passou a precisar navegar pra Cartões pelo próprio QuickAction do Hero — um
// componente de dados não pode chamar `setActiveSection` que vivesse só aqui dentro.
const AppShell = ({ home, movimentacoes, cartoes, metas, activeSection, onNavegar, confirmacao }) => {
  const { logout } = useAuth();
  const { temaEscuro, setTemaEscuro } = useTema();
  const ehDesktop = useEhDesktop();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout', error);
      toast.error('Não foi possível sair. Tente novamente.');
    }
  };

  const renderSecao = () => {
    switch (activeSection) {
      case 'inicio':
        return home;
      case 'movimentacoes':
        return movimentacoes;
      case 'cartoes':
        return cartoes;
      case 'metas':
        return metas;
      default:
        return home;
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground pb-24 lg:pb-8 lg:pt-24">
      <a
        href="#conteudo-principal"
        className="focus-ring sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded-xl focus-visible:border focus-visible:border-border focus-visible:bg-surface-raised focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground"
      >
        Pular para o conteúdo
      </a>

      {/* Mobile/tablet: só Tema+Logout flutuando no canto, sem barra full-width —
          a navegação principal já mora na BottomNavigation. No desktop esses dois
          controles vivem dentro da DesktopNavigation flutuante abaixo. */}
      <div className="lg:hidden fixed z-30 flex items-center gap-1 top-[calc(env(safe-area-inset-top)+0.5rem)] right-[calc(env(safe-area-inset-right)+1rem)]">
        <IconButton
          aria-label={temaEscuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          onClick={() => setTemaEscuro(!temaEscuro)}
        >
          {temaEscuro ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
        </IconButton>
        <IconButton aria-label="Sair" onClick={handleLogout}>
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
        </IconButton>
      </div>

      <DesktopNavigation
        activeSection={activeSection}
        onNavegar={onNavegar}
        temaEscuro={temaEscuro}
        onAlternarTema={() => setTemaEscuro(!temaEscuro)}
        onSair={handleLogout}
      />

      <main id="conteudo-principal" tabIndex={-1} className="pt-[calc(env(safe-area-inset-top)+3.75rem)] lg:pt-0">
        {renderSecao()}
      </main>

      <BottomNavigation ativo={activeSection} aoNavegar={onNavegar} />
      <PWAController />
      <Toaster
        position={ehDesktop ? 'top-right' : 'bottom-center'}
        offset={24}
        mobileOffset={{ bottom: 'calc(88px + env(safe-area-inset-bottom))', left: '16px', right: '16px' }}
        theme={temaEscuro ? 'dark' : 'light'}
        toastOptions={{
          style: {
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-foreground)',
            borderRadius: '1rem',
            boxShadow: '0 8px 24px rgb(0 0 0 / 0.08)',
          },
        }}
      />
      <ConfirmDialog
        aberto={!!confirmacao}
        titulo={confirmacao?.titulo}
        descricao={confirmacao?.descricao}
        textoConfirmar={confirmacao?.textoConfirmar}
        carregando={confirmacao?.carregando}
        onConfirmar={confirmacao?.onConfirmar}
        onCancelar={confirmacao?.onCancelar}
      />
    </div>
  );
};

export default AppShell;
