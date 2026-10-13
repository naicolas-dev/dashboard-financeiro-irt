import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider } from '@chakra-ui/react';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/inter';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexto/AuthContext.jsx';
import { TemaProvider } from './contexto/TemaContext.jsx';
import { chakraSystem } from './tema/chakraSystem.js';

// Sandbox de UI isolado (Etapa 1 da modernização visual) — só existe em dev,
// nunca entra no bundle de produção. Sem router: só checa o path na raiz.
const ehDesignLab = import.meta.env.DEV && window.location.pathname === '/design-lab';
const DesignLab = import.meta.env.DEV ? lazy(() => import('./paginas/DesignLab.jsx')) : null;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {ehDesignLab ? (
      <Suspense fallback={null}>
        <DesignLab />
      </Suspense>
    ) : (
      // A regra de prefers-reduced-motion do index.css só alcança animação CSS;
      // animações do Motion (JS) precisam deste opt-in pra respeitá-la também.
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <TemaProvider>
            <ChakraProvider value={chakraSystem}>
              <App />
            </ChakraProvider>
          </TemaProvider>
        </AuthProvider>
      </MotionConfig>
    )}
  </StrictMode>
);
