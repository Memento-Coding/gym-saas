/**
 * env — Configuración central de entorno de la aplicación.
 *
 * Centraliza la lectura de las variables `import.meta.env.*` para que el resto
 * del código no dependa directamente de Vite y para exponer valores derivados
 * (p. ej. si el backend real está activo).
 *
 * Variables soportadas (.env / .env.development / .env.production):
 *
 *  - VITE_API_MODE       'api' | 'local'   Fuente de datos. 'local' (default)
 *                                          usa IndexedDB/localStorage; 'api'
 *                                          conecta con la API REST de GymOps.
 *  - VITE_API_BASE_URL   string            Base URL del API Gateway.
 *  - VITE_AUTH_BYPASS    'true' | 'false'  Salta Cognito y usa un usuario mock.
 *  - VITE_E2E_STORAGE    'localStorage'    Fuerza storage local (tests E2E).
 *  - VITE_COGNITO_USER_POOL_ID
 *  - VITE_COGNITO_CLIENT_ID
 *  - VITE_COGNITO_REGION
 *  - VITE_COGNITO_OAUTH_DOMAIN
 *  - VITE_COGNITO_REDIRECT_SIGN_IN
 *  - VITE_COGNITO_REDIRECT_SIGN_OUT
 */

import type { AuthConfig } from '@/types/settings';

/** Lee una variable de entorno de Vite de forma segura (string | undefined). */
function readEnv(key: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value && value.length > 0 ? value : undefined;
}

/**
 * Modo de datos activo.
 *
 * - 'api'   → la app lee/escribe contra la API REST real (API Gateway + Lambdas).
 * - 'local' → persistencia client-side (IndexedDB + localStorage).
 *
 * El modo E2E (VITE_E2E_STORAGE=localStorage) SIEMPRE fuerza 'local' para que los
 * tests de Playwright puedan sembrar datos de forma determinista, sin importar
 * VITE_API_MODE.
 */
export function getApiMode(): 'api' | 'local' {
  if (readEnv('VITE_E2E_STORAGE') === 'localStorage') {
    return 'local';
  }
  return readEnv('VITE_API_MODE') === 'api' ? 'api' : 'local';
}

/** true si la app debe usar la API real como fuente de datos. */
export function isApiMode(): boolean {
  return getApiMode() === 'api';
}

/**
 * Base URL del API Gateway. En modo API es obligatoria; si falta se lanza un
 * error temprano y explícito para evitar peticiones a `undefined/...`.
 */
export function getApiBaseUrl(): string {
  const url = readEnv('VITE_API_BASE_URL');
  if (!url) {
    throw new Error(
      'VITE_API_BASE_URL no está configurada. Define la URL del API Gateway en tu archivo .env para usar VITE_API_MODE=api.',
    );
  }
  // Normaliza quitando el slash final para construir rutas de forma uniforme.
  return url.replace(/\/+$/, '');
}

/** true si el bypass de autenticación de desarrollo está activo. */
export function isAuthBypass(): boolean {
  return readEnv('VITE_AUTH_BYPASS') === 'true';
}

/**
 * Resuelve la configuración de Cognito desde variables de entorno.
 * Retorna null si no hay un User Pool configurado (p. ej. en modo bypass local).
 */
export function getAuthConfig(): AuthConfig | null {
  const userPoolId = readEnv('VITE_COGNITO_USER_POOL_ID');
  const userPoolClientId = readEnv('VITE_COGNITO_CLIENT_ID');

  if (!userPoolId || !userPoolClientId) {
    return null;
  }

  return {
    userPoolId,
    userPoolClientId,
    region: readEnv('VITE_COGNITO_REGION') ?? 'us-east-1',
    oauthDomain: readEnv('VITE_COGNITO_OAUTH_DOMAIN') ?? '',
    redirectSignIn:
      readEnv('VITE_COGNITO_REDIRECT_SIGN_IN') ??
      (typeof window !== 'undefined' ? window.location.origin : ''),
    redirectSignOut:
      readEnv('VITE_COGNITO_REDIRECT_SIGN_OUT') ??
      (typeof window !== 'undefined' ? `${window.location.origin}/login` : ''),
  };
}
