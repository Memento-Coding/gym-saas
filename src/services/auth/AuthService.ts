/**
 * AuthService — Wrapper sobre AWS Amplify v6 Auth.
 *
 * Provee funciones de autenticación contra AWS Cognito:
 * signIn, signInWithGoogle, signUp, confirmSignUp, signOut,
 * getCurrentUser, getAccessToken, resetPassword, confirmResetPassword.
 *
 * Gestión de tokens JWT:
 * - Amplify v6 maneja automáticamente el almacenamiento seguro de tokens
 *   (access token, refresh token, ID token) en el cliente.
 * - El refresh automático del access token se realiza de forma transparente
 *   por Amplify cuando se invoca fetchAuthSession(). Si el access token expiró,
 *   Amplify usa el refresh token para obtener uno nuevo sin interrumpir al usuario.
 *
 * @see Requirements 16.1, 16.2, 16.3, 16.5, 16.6
 */

import { Amplify } from 'aws-amplify';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signOut as amplifySignOut,
  getCurrentUser as amplifyGetCurrentUser,
  fetchAuthSession,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
  signInWithRedirect,
  resendSignUpCode as amplifyResendSignUpCode,
  updateUserAttributes,
} from 'aws-amplify/auth';

import type { AuthConfig } from '@/types/settings';
import { termsAcceptanceValue } from '@/config/legal';

// ─── Tipos de resultado ────────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  name?: string;
  /** `<versión>|<fecha>` de los términos aceptados, si ya constan. */
  termsAccepted?: string;
}

export interface SignInResult {
  isSignedIn: boolean;
  nextStep?: string;
}

export interface SignUpResult {
  isSignUpComplete: boolean;
  nextStep?: string;
}

export interface ResetPasswordResult {
  isPasswordReset: boolean;
  nextStep?: string;
}

// ─── Configuración ─────────────────────────────────────────────────────────────

/**
 * Configura AWS Amplify con los parámetros de autenticación de Cognito.
 * Debe llamarse una sola vez al inicio de la aplicación (ej. en main.tsx).
 */
export function configureAuth(config: AuthConfig): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        loginWith: {
          oauth: {
            domain: config.oauthDomain,
            scopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
            redirectSignIn: [config.redirectSignIn],
            redirectSignOut: [config.redirectSignOut],
            responseType: 'code',
          },
        },
      },
    },
  });
}

// ─── Autenticación con email/password ──────────────────────────────────────────

/**
 * Inicia sesión con email y contraseña.
 * Requirement 16.2: soportar inicio de sesión con email y contraseña.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const result = await amplifySignIn({ username: email, password });
  return {
    isSignedIn: result.isSignedIn,
    nextStep: result.nextStep?.signInStep,
  };
}

// ─── Autenticación con Google OAuth ────────────────────────────────────────────

/**
 * Inicia sesión con cuenta de Google (OAuth 2.0 social login).
 * Redirige al usuario al flujo OAuth de Google configurado en Cognito.
 * Requirement 16.3: soportar inicio de sesión con Google.
 */
export async function signInWithGoogle(): Promise<void> {
  // Sin esto, Google reutiliza su sesión abierta y tras cerrar sesión se entra sin preguntar.
  await signInWithRedirect({ provider: 'Google', options: { prompt: 'SELECT_ACCOUNT' } });
}

// ─── Registro ──────────────────────────────────────────────────────────────────

/**
 * Registra un nuevo usuario con email y contraseña.
 * Después del registro se requiere confirmación con código de verificación.
 */
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const result = await amplifySignUp({
    username: email,
    password,
    options: {
      userAttributes: { email, 'custom:terms_accepted': termsAcceptanceValue() },
    },
  });
  return {
    isSignUpComplete: result.isSignUpComplete,
    nextStep: result.nextStep?.signUpStep,
  };
}

/**
 * Confirma el registro con el código de verificación enviado por email.
 */
export async function confirmSignUp(email: string, confirmationCode: string): Promise<SignUpResult> {
  const result = await amplifyConfirmSignUp({
    username: email,
    confirmationCode,
  });
  return {
    isSignUpComplete: result.isSignUpComplete,
    nextStep: result.nextStep?.signUpStep,
  };
}

// ─── Sesión ────────────────────────────────────────────────────────────────────

/** Reenvía el código de verificación de una cuenta sin confirmar. */
export async function resendSignUpCode(email: string): Promise<void> {
  await amplifyResendSignUpCode({ username: email });
}

/**
 * Cierra la sesión del usuario actual, eliminando todos los tokens almacenados.
 * Requirement 16.7: cerrar sesión eliminando tokens.
 */
export async function signOut(): Promise<void> {
  await amplifySignOut();
}

/**
 * Obtiene la información del usuario autenticado actual.
 * Lanza error si no hay sesión activa.
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const user = await amplifyGetCurrentUser();
  // Con Google, username es un id interno y signInDetails viene vacío: el dato real está en el ID token.
  let claims: Record<string, unknown> | undefined;
  try {
    claims = (await fetchAuthSession()).tokens?.idToken?.payload;
  } catch {
    // Mostrar el nombre no debe cerrar una sesión válida si el token no se puede leer.
  }
  return {
    userId: user.userId,
    username: user.username,
    email: (claims?.email as string | undefined) ?? user.signInDetails?.loginId,
    name: claims?.name as string | undefined,
    termsAccepted: claims?.['custom:terms_accepted'] as string | undefined,
  };
}

/** Guarda la aceptación de una cuenta que no pasó por el formulario de registro (Google). */
export async function recordTermsAcceptance(): Promise<void> {
  await updateUserAttributes({ userAttributes: { 'custom:terms_accepted': termsAcceptanceValue() } });
}

/**
 * Obtiene el access token JWT de la sesión actual.
 *
 * Requirement 16.5: gestionar tokens JWT de forma segura en el cliente.
 * Requirement 16.6: renovar la sesión automáticamente usando el refresh token.
 *
 * Amplify v6 realiza el refresh automático del access token de forma transparente
 * cuando se invoca fetchAuthSession(). Si el token expiró, Amplify usa el
 * refresh token para obtener uno nuevo sin interrumpir la experiencia del usuario.
 */
export async function getAccessToken(): Promise<string | undefined> {
  const session = await fetchAuthSession({ forceRefresh: false });
  return session.tokens?.accessToken?.toString();
}

/**
 * Obtiene el ID token JWT de la sesión actual.
 *
 * El API Gateway de GymOps valida el JWT con el authorizer de Cognito y espera
 * el ID token (contiene los claims de identidad del usuario) en el header
 * `Authorization: Bearer <token>`. Amplify realiza el refresh automático de
 * forma transparente al invocar fetchAuthSession().
 *
 * @see gym-sass-infra/docs/API.md — "El IdToken en la respuesta es el que se usa como Bearer token."
 */
export async function getIdToken(): Promise<string | undefined> {
  const session = await fetchAuthSession({ forceRefresh: false });
  return session.tokens?.idToken?.toString();
}

// ─── Recuperación de contraseña ────────────────────────────────────────────────

/**
 * Inicia el flujo de recuperación de contraseña.
 * Envía un código de verificación al email del usuario.
 * Requirement 16.8: recuperación de contraseña mediante verificación por email.
 */
export async function resetPassword(email: string): Promise<ResetPasswordResult> {
  const result = await amplifyResetPassword({ username: email });
  return {
    isPasswordReset: result.isPasswordReset,
    nextStep: result.nextStep?.resetPasswordStep,
  };
}

/**
 * Confirma el nuevo password con el código de verificación recibido por email.
 */
export async function confirmResetPassword(
  email: string,
  confirmationCode: string,
  newPassword: string,
): Promise<void> {
  await amplifyConfirmResetPassword({
    username: email,
    confirmationCode,
    newPassword,
  });
}
