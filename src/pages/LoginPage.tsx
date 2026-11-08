/**
 * LoginPage — Página de inicio de sesión.
 *
 * Soporta autenticación con email/contraseña y Google OAuth.
 * Si el usuario ya está autenticado, redirige al dashboard.
 *
 * @see Requirement 16.2: soportar inicio de sesión con email y contraseña.
 * @see Requirement 16.3: soportar inicio de sesión con Google (OAuth 2.0).
 */

import { useState } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useAuth } from '@/services/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { authErrorMessage } from '@/services/auth/authErrors';
import { clearReturnPath, rememberReturnPath, safeReturnPath } from '@/services/auth/returnPath';
import { PasswordInput } from '@/components/ui/password-input';

const springTransition = { type: 'spring' as const, duration: 0.35, bounce: 0 };

export function LoginPage() {
  const { isAuthenticated, isLoading, login, loginWithGoogle, oauthError, clearOAuthError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { from?: unknown; notice?: string } | null;
  const returnTo = safeReturnPath(routeState?.from);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  function goToVerification() {
    navigate('/registro', { state: { email, verify: true } });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    clearOAuthError();
    clearReturnPath();
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.isSignedIn) {
        navigate(returnTo, { replace: true });
      } else if (result.nextStep === 'CONFIRM_SIGN_UP') {
        goToVerification();
      } else {
        setError('Inicio de sesión incompleto. Verifica tu cuenta.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'UserNotConfirmedException') {
        goToVerification();
        return;
      }
      setError(authErrorMessage(err, 'Error al iniciar sesión'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    clearOAuthError();
    setIsGoogleLoading(true);
    try {
      if (returnTo !== '/') rememberReturnPath(returnTo);
      await loginWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err, 'Error al iniciar sesión con Google'));
      setIsGoogleLoading(false);
    }
  }

  const shownError =
    error || (oauthError ? authErrorMessage(oauthError, 'No se pudo iniciar sesión con Google. Intenta de nuevo.') : '');

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(35,40,46,0.08) 0%, transparent 60%), ' +
            'radial-gradient(ellipse 60% 40% at 80% 100%, rgba(35,40,46,0.04) 0%, transparent 50%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={springTransition}
        className="w-full max-w-sm"
      >
        {/* Brand mark above card */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-white shadow-md">
            <span className="text-xl font-bold leading-none">G</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">GymOps</h1>
        </div>

        <Card className="shadow-xl border-black/[0.06]">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg font-semibold">Iniciar sesión</CardTitle>
            <CardDescription className="text-sm">Ingresa tu correo y contraseña</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                  <Link
                    to="/recuperar-password"
                    state={{ email }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-10 rounded-xl"
                />
              </div>

              {routeState?.notice && !shownError && (
                <div role="status" className="rounded-xl bg-success-50 px-3 py-2.5 text-sm text-success-700">
                  {routeState.notice}
                </div>
              )}

              {shownError && (
                <div role="alert" className="rounded-xl bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                  {shownError}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="pressable w-full h-10 rounded-xl font-medium mt-1"
              >
                {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </Button>

              <div className="relative flex items-center justify-center my-1">
                <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                <span className="relative bg-card px-2.5 text-xs text-muted-foreground">
                  o continúa con
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isGoogleLoading}
                onClick={handleGoogleLogin}
                className="pressable w-full h-10 rounded-xl font-medium"
              >
                <svg className="mr-2 size-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {isGoogleLoading ? 'Conectando...' : 'Continuar con Google'}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Al continuar con Google aceptas las Condiciones y la Política de privacidad.
              </p>

              <p className="text-center text-sm text-muted-foreground pt-1">
                ¿No tienes cuenta?{' '}
                <Link to="/registro" className="text-primary font-medium underline underline-offset-4">
                  Regístrate
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/privacidad" className="hover:underline">Privacidad</Link>
          {' · '}
          <Link to="/terminos" className="hover:underline">Condiciones del servicio</Link>
        </p>
      </motion.div>
    </div>
  );
}
