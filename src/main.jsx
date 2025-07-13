import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexto/AuthContext.jsx'; // Importe o AuthProvider
import { TemaProvider } from './contexto/TemaContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider> {/* Envolva o App com o AuthProvider */}
      <TemaProvider>
        <App />
      </TemaProvider>
    </AuthProvider>
  </StrictMode>,
)
