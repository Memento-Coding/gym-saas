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
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { resetPassword, confirmResetPassword } from '@/services/auth';
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

const springTransition = { type: 'spring' as const, duration: 0.35, bounce: 0 };

type Step = 'request' | 'confirm';

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setStep('confirm');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al enviar el código de recuperación';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmResetPassword(email, code, newPassword);
      navigate('/login', { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al restablecer la contraseña';
      setError(message);
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
                : `Ingresa el código enviado a ${email} y tu nueva contraseña`}
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
                  <Link to="/login" className="text-primary hover:underline">
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
                    autoComplete="one-time-code"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-password">Nueva contraseña</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-new-password">Confirmar contraseña</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
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
                    className="text-primary hover:underline"
                  >
                    Volver al inicio de sesión
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
