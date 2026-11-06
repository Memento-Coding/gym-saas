import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/components/ui/sonner'
import { configureAuth } from '@/services/auth'

// Configura Amplify/Cognito con las variables de entorno.
// Si VITE_AUTH_BYPASS=true, AuthProvider ignora esta config y usa el mock local.
configureAuth({
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '',
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
  region: import.meta.env.VITE_COGNITO_REGION ?? 'us-east-1',
  oauthDomain: import.meta.env.VITE_COGNITO_OAUTH_DOMAIN ?? '',
  redirectSignIn: import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN ?? window.location.origin,
  redirectSignOut: import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT ?? window.location.origin,
})

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
