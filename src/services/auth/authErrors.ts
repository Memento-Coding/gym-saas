/** Traduce los errores de Cognito a mensajes para el usuario, sin exponer el texto crudo en inglés. */

const WRONG_CREDENTIALS = 'Correo o contraseña incorrectos.';
const TOO_MANY_ATTEMPTS = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';

const MESSAGES: Record<string, string> = {
  NotAuthorizedException: WRONG_CREDENTIALS,
  // Mismo texto que contraseña errada: no revelar qué correos tienen cuenta.
  UserNotFoundException: WRONG_CREDENTIALS,
  UserNotConfirmedException: 'Confirma tu correo antes de iniciar sesión.',
  UsernameExistsException: 'Ya existe una cuenta con ese correo.',
  CodeMismatchException: 'El código no es correcto.',
  ExpiredCodeException: 'El código expiró. Solicita uno nuevo.',
  InvalidPasswordException: 'La contraseña no cumple los requisitos.',
  LimitExceededException: TOO_MANY_ATTEMPTS,
  TooManyRequestsException: TOO_MANY_ATTEMPTS,
  TooManyFailedAttemptsException: TOO_MANY_ATTEMPTS,
};

export function authErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  // Cognito usa NotAuthorizedException también para el bloqueo por intentos.
  if (/attempts exceeded/i.test(err.message)) return TOO_MANY_ATTEMPTS;
  // El mensaje de la lambda ya está en español; solo sobra el prefijo de Cognito. Con Google llega con otro nombre.
  const lambdaMessage = err.message.match(/failed with error (.+)/i)?.[1];
  if (lambdaMessage) return lambdaMessage;
  if (err.name === 'UserLambdaValidationException') return fallback;
  return MESSAGES[err.name] ?? fallback;
}

/** Recuperación: correo sin cuenta o cuenta solo de Google. No se revela cuál de los dos es. */
export function isHiddenAccountResetError(err: unknown): boolean {
  return (
    err instanceof Error &&
    ['UserNotFoundException', 'NotAuthorizedException', 'InvalidParameterException'].includes(err.name)
  );
}
