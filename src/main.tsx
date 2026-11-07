import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/components/ui/sonner'
import { configureAuth } from '@/services/auth/AuthService'
import { initApiAuthBridge } from '@/services/api/authToken'
import { getAuthConfig, isApiMode } from '@/config/env'

// ─── Configuración de autenticación (Cognito) ──────────────────────────────────
// Solo se configura Amplify si hay un User Pool definido en el entorno. En modo
// bypass local (sin Cognito) esto se omite y el AuthProvider usa el usuario mock.
const authConfig = getAuthConfig();
if (authConfig) {
  configureAuth(authConfig);
}

// ─── Bridge de token para el apiClient ──────────────────────────────────────────
// Registra el provider que adjunta el JWT de Cognito en las llamadas a la API.
// Solo es necesario cuando la app consume la API real.
if (isApiMode()) {
  initApiAuthBridge();
}

// E2E test helper: expose storage reset in development mode
if (import.meta.env.DEV) {
  import('@/services/storage').then(({ resetStorageService }) => {
    (window as Window & { __resetStorage?: () => void }).__resetStorage = resetStorageService;
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster position="top-right" richColors />
  </StrictMode>,
)
