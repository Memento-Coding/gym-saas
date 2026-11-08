/**
 * ForgotPasswordPage — Página de recuperación de contraseña.
 *
 * Flujo en dos pasos:
 * 1. Solicitar código de verificación (ingresando email)
 * 2. Ingresar código + nueva contraseña + confirmar contraseña
 *
 * @see Requirement 16.8: recuperación de contraseña mediante verificación por email.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { resetPassword, confirmResetPassword } from '@/services/auth';
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
import { authErrorMessage, isHiddenAccountResetError } from '@/services/auth/authErrors';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordRequirements } from '@/components/auth/PasswordRequirements';
import { ResendCodeButton } from '@/components/auth/ResendCodeButton';

const springTransition = { type: 'spring' as const, duration: 0.35, bounce: 0 };

type Step = 'request' | 'confirm';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const routeState = useLocation().state as { email?: string } | null;

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(routeState?.email ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function sendCode(): Promise<boolean> {
    setError('');
    try {
      await resetPassword(email);
      return true;
    } catch (err) {
      if (isHiddenAccountResetError(err)) return true;
      setError(authErrorMessage(err, 'Error al enviar el código de recuperación'));
      return false;
    }
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    if (await sendCode()) setStep('confirm');
    setIsSubmitting(false);
  }

  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    const strength = passwordSchema().safeParse(newPassword);
    if (!strength.success) {
      setError(strength.error.issues[0].message);
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmResetPassword(email, code, newPassword);
      navigate('/login', { replace: true, state: { notice: 'Contraseña actualizada. Ya puedes iniciar sesión.' } });
    } catch (err) {
      setError(
        isHiddenAccountResetError(err)
          ? 'El código no es correcto.'
          : authErrorMessage(err, 'Error al restablecer la contraseña'),
      );
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
              {step === 'request' ? 'Recuperar contraseña' : 'Nueva contraseña'}
            </CardTitle>
            <CardDescription>
              {step === 'request'
                ? 'Ingresa tu email para recibir un código de recuperación'
                : `Si ${email} tiene cuenta, te llegó un código. Si entras con Google, no necesitas contraseña: usa Continuar con Google.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'request' ? (
              <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
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

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Enviando...' : 'Enviar código'}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary underline underline-offset-4">
                    Volver al inicio de sesión
                  </Link>
                </p>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="flex flex-col gap-4">
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

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-password">Nueva contraseña</Label>
                  <PasswordInput
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <PasswordRequirements password={newPassword} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-new-password">Confirmar contraseña</Label>
                  <PasswordInput
                    id="confirm-new-password"
                    placeholder="Repite tu nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Restableciendo...' : 'Restablecer contraseña'}
                </Button>

                <ResendCodeButton onResend={sendCode} />

                <p className="text-center text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('request');
                      setError('');
                      setCode('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="text-primary underline underline-offset-4"
                  >
                    Cambiar correo
                  </button>
                  {' · '}
                  <Link to="/login" className="text-primary underline underline-offset-4">
                    Volver al inicio de sesión
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
