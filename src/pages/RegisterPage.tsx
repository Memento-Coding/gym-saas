/**
 * RegisterPage — Página de registro de nuevos usuarios administrativos.
 *
 * Flujo en dos pasos:
 * 1. Formulario de registro (email, contraseña, confirmar contraseña)
 * 2. Verificación con código enviado por email
 *
 * @see Requirement 16.10: registro de nuevos usuarios administrativos con verificación de email.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useAuth } from '@/services/auth';
import { passwordSchema } from '@/utils/validation';
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
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { ResendCodeButton } from '@/components/auth/ResendCodeButton';

const springTransition = { type: 'spring' as const, duration: 0.35, bounce: 0 };

type Step = 'register' | 'verify';

export function RegisterPage() {
  const { register, confirmRegistration, resendCode } = useAuth();
  const navigate = useNavigate();
  const routeState = useLocation().state as { email?: string; verify?: boolean } | null;
  const arrivedToVerify = Boolean(routeState?.verify && routeState.email);

  const [step, setStep] = useState<Step>(arrivedToVerify ? 'verify' : 'register');
  const [email, setEmail] = useState(routeState?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function resend(): Promise<boolean> {
    setError('');
    try {
      await resendCode(email);
      return true;
    } catch (err) {
      setError(authErrorMessage(err, 'No se pudo reenviar el código'));
      return false;
    }
  }

  // Quien llega desde el login no tiene un código vigente. El ref evita un doble envío en StrictMode.
  const autoResent = useRef(false);
  useEffect(() => {
    if (!arrivedToVerify || autoResent.current) return;
    autoResent.current = true;
    void resendCode(routeState?.email ?? '').catch((err: unknown) =>
      setError(authErrorMessage(err, 'No se pudo reenviar el código')),
    );
  }, [arrivedToVerify, resendCode, routeState?.email]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const strength = passwordSchema().safeParse(password);
    if (!strength.success) {
      setError(strength.error.issues[0].message);
      return;
    }

    if (!acceptedTerms) {
      setError('Debes aceptar las Condiciones y la Política de privacidad.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register(email, password);
      if (result.isSignUpComplete) {
        navigate('/login', { replace: true, state: { notice: 'Cuenta creada. Ya puedes iniciar sesión.' } });
      } else {
        setStep('verify');
      }
    } catch (err) {
      setError(authErrorMessage(err, 'Error al registrar la cuenta'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = await confirmRegistration(email, code);
      if (result.isSignUpComplete) {
        navigate('/login', { replace: true, state: { notice: 'Cuenta verificada. Ya puedes iniciar sesión.' } });
      } else {
        setError('Verificación incompleta. Intenta nuevamente.');
      }
    } catch (err) {
      setError(authErrorMessage(err, 'Error al verificar el código'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springTransition}
        className="w-full max-w-sm"
      >
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {step === 'register' ? 'Crear cuenta' : 'Verificar email'}
            </CardTitle>
            <CardDescription>
              {step === 'register'
                ? 'Registra una nueva cuenta de administrador'
                : `Ingresa el código de verificación enviado a ${email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'register' ? (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <PasswordRequirements password={password} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                  <PasswordInput
                    id="confirm-password"
                    placeholder="Repite tu contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="accept-terms"
                    className="mt-0.5"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  />
                  <Label htmlFor="accept-terms" className="block text-sm font-normal leading-snug">
                    Acepto las{' '}
                    <Link to="/terminos" target="_blank" className="text-primary underline underline-offset-4">Condiciones del servicio</Link>
                    {' y la '}
                    <Link to="/privacidad" target="_blank" className="text-primary underline underline-offset-4">Política de privacidad</Link>.
                  </Label>
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Registrando...' : 'Crear cuenta'}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary underline underline-offset-4">
                    ¿Ya tienes cuenta? Inicia sesión
                  </Link>
                </p>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="code">Código de verificación</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    title="Ingresa los 6 dígitos del código"
                    autoComplete="one-time-code"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Verificando...' : 'Verificar'}
                </Button>

                <ResendCodeButton onResend={resend} />

                <p className="text-center text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('register');
                      setError('');
                      setCode('');
                    }}
                    className="text-primary underline underline-offset-4"
                  >
                    Volver al registro
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
