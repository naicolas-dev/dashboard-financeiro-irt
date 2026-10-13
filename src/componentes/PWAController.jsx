import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTema } from '../contexto/TemaContext.jsx';

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_INSTALL_MS = 4 * UM_DIA_MS;
const INTERVALO_CHECAGEM_MS = 60 * 60 * 1000; // ~1h, pedido explícito (seção 14)

const CHAVE_INSTALL_DISMISSED = 'pwaInstallDismissedAt';
const CHAVE_IOS_INSTRUCAO_VISTA = 'pwaIosInstrucaoVista';

const TOAST_ID_OFFLINE = 'pwa-offline';
const TOAST_ID_UPDATE = 'pwa-update';
const TOAST_ID_INSTALL = 'pwa-install';

function estaInstalado() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function ehIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ehIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const ehSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ehIos && ehSafari;
}

// Checagem periódica de atualização — padrão oficial do vite-plugin-pwa (não
// usa resposta HTTP cacheada, pula se offline ou se já tiver uma instalação em
// andamento). Centralizado aqui pra não duplicar a lógica no onRegisteredSW.
function agendarChecagemPeriodica(registration) {
  if (!registration) return undefined;

  const id = setInterval(async () => {
    if (registration.installing || !navigator.onLine) return;

    try {
      const resposta = await fetch(registration.active?.scriptURL ?? registration.scope, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      });
      if (resposta?.status === 200) await registration.update();
    } catch {
      // Sem conexão/servidor fora do ar — tenta de novo no próximo ciclo.
    }
  }, INTERVALO_CHECAGEM_MS);

  return () => clearInterval(id);
}

// Centraliza toda a lógica de PWA (registro do Service Worker, update
// lifecycle, conectividade, install prompt Android/desktop e instrução
// iOS) num único lugar — nada disso fica espalhado em App.jsx/Home/
// Movimentações etc. Monta uma vez em AppShell.jsx, sem UI própria: tudo
// passa pelo Sonner já usado no resto do app.
function PWAController() {
  const { temaEscuro } = useTema();
  const deferredPromptRef = useRef(null);

  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      return agendarChecagemPeriodica(registration);
    },
    onRegisterError(erro) {
      console.error('Erro ao registrar o Service Worker:', erro);
    },
  });

  // theme-color em runtime segue o TemaContext (única autoridade) — o valor no
  // index.html é só o fallback estático inicial.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', temaEscuro ? '#090a0c' : '#f7f6f2');
    document.documentElement.style.colorScheme = temaEscuro ? 'dark' : 'light';
  }, [temaEscuro]);

  useEffect(() => {
    if (!offlineReady) return;
    toast.success('Aplicativo disponível offline', {
      description: 'Alguns dados ainda podem exigir conexão.',
    });
  }, [offlineReady]);

  useEffect(() => {
    if (!needRefresh) return;
    toast('Nova versão disponível', {
      id: TOAST_ID_UPDATE,
      duration: Infinity,
      action: { label: 'Atualizar', onClick: () => updateServiceWorker(true) },
      cancel: { label: 'Agora não', onClick: () => setNeedRefresh(false) },
      onDismiss: () => setNeedRefresh(false),
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  // Conectividade — sem polling, só os eventos nativos do browser.
  useEffect(() => {
    const aoFicarOffline = () => {
      toast('Sem conexão', {
        id: TOAST_ID_OFFLINE,
        duration: Infinity,
        description: 'Alguns dados podem estar indisponíveis ou desatualizados.',
      });
    };
    const aoFicarOnline = () => {
      toast.dismiss(TOAST_ID_OFFLINE);
      toast.success('Conexão restabelecida');
    };

    window.addEventListener('offline', aoFicarOffline);
    window.addEventListener('online', aoFicarOnline);
    if (!navigator.onLine) aoFicarOffline();

    return () => {
      window.removeEventListener('offline', aoFicarOffline);
      window.removeEventListener('online', aoFicarOnline);
    };
  }, []);

  // Install prompt — Android/desktop/Chromium (beforeinstallprompt) + instrução
  // discreta pro iOS Safari (que não tem esse evento).
  useEffect(() => {
    if (estaInstalado()) return;

    const aoPoderInstalar = (evento) => {
      evento.preventDefault();
      deferredPromptRef.current = evento;

      const dispensadoEm = Number(localStorage.getItem(CHAVE_INSTALL_DISMISSED) || 0);
      if (Date.now() - dispensadoEm < COOLDOWN_INSTALL_MS) return;

      toast('Instalar aplicativo', {
        id: TOAST_ID_INSTALL,
        duration: Infinity,
        action: {
          label: 'Instalar',
          onClick: async () => {
            const evt = deferredPromptRef.current;
            if (!evt) return;
            deferredPromptRef.current = null;
            await evt.prompt();
          },
        },
        cancel: {
          label: 'Agora não',
          onClick: () => localStorage.setItem(CHAVE_INSTALL_DISMISSED, String(Date.now())),
        },
        onDismiss: () => localStorage.setItem(CHAVE_INSTALL_DISMISSED, String(Date.now())),
      });
    };

    const aoInstalar = () => {
      deferredPromptRef.current = null;
      localStorage.removeItem(CHAVE_INSTALL_DISMISSED);
      toast.dismiss(TOAST_ID_INSTALL);
    };

    window.addEventListener('beforeinstallprompt', aoPoderInstalar);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoPoderInstalar);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  useEffect(() => {
    if (estaInstalado() || !ehIosSafari()) return;
    if (localStorage.getItem(CHAVE_IOS_INSTRUCAO_VISTA)) return;

    toast('Instale este app no seu iPhone/iPad', {
      description: 'Toque em Compartilhar e depois em "Adicionar à Tela de Início".',
      duration: 8000,
    });
    localStorage.setItem(CHAVE_IOS_INSTRUCAO_VISTA, 'true');
  }, []);

  return null;
}

export default PWAController;
