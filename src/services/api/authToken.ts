/**
 * authToken — Bridge entre la autenticación (Cognito/Amplify) y el apiClient.
 *
 * Registra en el apiClient un TokenProvider que resuelve el ID token JWT actual
 * de Cognito. En modo bypass de autenticación (desarrollo local) no hay sesión
 * de Cognito, por lo que el provider retorna undefined y las peticiones salen
 * sin header Authorization (el modo API normalmente no se combina con bypass).
 *
 * Debe invocarse una sola vez en el arranque de la app (main.tsx), después de
 * configurar Amplify.
 */

import { setApiTokenProvider } from './apiClient';
import { getIdToken } from '@/services/auth/AuthService';
import { isAuthBypass } from '@/config/env';

/**
 * Conecta el provider de token de Cognito al apiClient. Idempotente.
 */
export function initApiAuthBridge(): void {
  setApiTokenProvider(async () => {
    if (isAuthBypass()) {
      return undefined;
    }
    try {
      return await getIdToken();
    } catch {
      // Sin sesión activa: las rutas protegidas devolverán 401 y la UI
      // redirigirá a login vía ProtectedRoute.
      return undefined;
    }
  });
}
