/**
 * AuthProvider — React Context para gestión del estado de autenticación.
 *
 * Provee estado de sesión, acciones de login/logout/registro, y
 * renovación automática de sesión (delegada a Amplify vía getAccessToken).
 *
 * ─── DEV MODE AUTH BYPASS ────────────────────────────────────────────────────
 * When the environment variable VITE_AUTH_BYPASS is set to "true" (see .env.development),
 * this provider skips all AWS Cognito calls and immediately provides a mock
 * authenticated user. This enables local development without a configured
 * Cognito User Pool.
 *
 * The bypass ONLY activates when `import.meta.env.VITE_AUTH_BYPASS === 'true'`.
 * Production builds (which do not include .env.development) are unaffected.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @see Requirements 16.4, 16.6, 16.7, 16.9
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import {
  getCurrentUser,
  getAccessToken,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  confirmSignUp,
} from './AuthService';
import type { AuthUser, SignInResult, SignUpResult } from './AuthService';

// ─── Dev Bypass Configuration ──────────────────────────────────────────────────

/**
 * When true, all Amplify/Cognito calls are skipped and a mock user is provided.
 * Controlled by the VITE_AUTH_BYPASS environment variable.
 */
const AUTH_BYPASS_ENABLED = import.meta.env.VITE_AUTH_BYPASS === 'true';

/** Mock user returned during dev bypass mode. */
const DEV_MOCK_USER: AuthUser = {
  userId: 'dev-user-001',
  username: 'dev@gymops.local',
  email: 'dev@gymops.local',
};

// ─── Tipos del Context ─────────────────────────────────────────────────────────

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<SignInResult>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<SignUpResult>;
  confirmRegistration: (email: string, code: string) => Promise<SignUpResult>;
  refreshSession: () => Promise<void>;
}

export type AuthContextValue = AuthState & AuthActions;

// ─── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────────

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;

  // Verificar sesión existente al montar
  useEffect(() => {
    // ─── DEV BYPASS: skip Cognito, set mock user immediately ───────────────
    if (AUTH_BYPASS_ENABLED) {
      setUser(DEV_MOCK_USER);
      setIsLoading(false);
      return;
    }

    // ─── Production: check Cognito session ─────────────────────────────────
    let cancelled = false;

    async function checkSession() {
      try {
        const currentUser = await getCurrentUser();
        if (!cancelled) {
          setUser(currentUser);
        }
      } catch {
        // No hay sesión activa — usuario no autenticado
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Acciones ──────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    // DEV BYPASS: immediately succeed without calling Amplify
    if (AUTH_BYPASS_ENABLED) {
      setUser(DEV_MOCK_USER);
      return { isSignedIn: true };
    }

    const result = await signIn(email, password);
    if (result.isSignedIn) {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    }
    return result;
  }, []);

  const loginWithGoogle = useCallback(async (): Promise<void> => {
    // DEV BYPASS: no-op, set mock user
    if (AUTH_BYPASS_ENABLED) {
      setUser(DEV_MOCK_USER);
      return;
    }

    await signInWithGoogle();
    // Nota: signInWithGoogle redirige, el estado se actualiza al volver
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    // DEV BYPASS: clear user without calling Amplify signOut
    if (AUTH_BYPASS_ENABLED) {
      setUser(null);
      return;
    }

    await signOut();
    setUser(null);
  }, []);

  const register = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    // DEV BYPASS: immediately report registration as complete
    if (AUTH_BYPASS_ENABLED) {
      return { isSignUpComplete: true };
    }

    return signUp(email, password);
  }, []);

  const confirmRegistration = useCallback(async (email: string, code: string): Promise<SignUpResult> => {
    // DEV BYPASS: immediately report confirmation as complete
    if (AUTH_BYPASS_ENABLED) {
      return { isSignUpComplete: true };
    }

    return confirmSignUp(email, code);
  }, []);

  /**
   * Renueva la sesión usando el refresh token (Amplify lo maneja internamente).
   * Requirement 16.6: renovar sesión sin interrumpir al usuario.
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    // DEV BYPASS: no-op, session is always valid
    if (AUTH_BYPASS_ENABLED) {
      return;
    }

    await getAccessToken();
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  }, []);

  // ─── Valor del Context ─────────────────────────────────────────────────────

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      login,
      loginWithGoogle,
      logout,
      register,
      confirmRegistration,
      refreshSession,
    }),
    [user, isLoading, isAuthenticated, login, loginWithGoogle, logout, register, confirmRegistration, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Hook para consumir el AuthContext.
 * Requirement 16.9: exponer nombre y email del usuario autenticado.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
