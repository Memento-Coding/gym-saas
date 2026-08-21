/**
 * RegisterPage — Página de registro de nuevos usuarios administrativos.
 *
 * Flujo en dos pasos:
 * 1. Formulario de registro (email, contraseña, confirmar contraseña)
 * 2. Verificación con código enviado por email
 *
 * @see Requirement 16.10: registro de nuevos usuarios administrativos con verificación de email.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const springTransition = { type: 'spring' as const, duration: 0.35, bounce: 0 };

type Step = 'register' | 'verify';

export function RegisterPage() {
  const { register, confirmRegistration } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register(email, password);
      if (result.isSignUpComplete) {
        navigate('/login', { replace: true });
      } else {
        setStep('verify');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al registrar la cuenta';
      setError(message);
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
        navigate('/login', { replace: true });
      } else {
        setError('Verificación incompleta. Intenta nuevamente.');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al verificar el código';
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
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repite tu contraseña"
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
                  {isSubmitting ? 'Registrando...' : 'Crear cuenta'}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/login" className="text-primary hover:underline">
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
                    autoComplete="one-time-code"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Verificando...' : 'Verificar'}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('register');
                      setError('');
                      setCode('');
                    }}
                    className="text-primary hover:underline"
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
