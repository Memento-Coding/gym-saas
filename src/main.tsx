import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/components/ui/sonner'

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
