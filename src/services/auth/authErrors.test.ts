import { describe, it, expect } from 'vitest';
import { authErrorMessage, isHiddenAccountResetError } from './authErrors';

const cognitoError = (name: string, message: string) => Object.assign(new Error(message), { name });

describe('authErrorMessage', () => {
  it('traduce credenciales incorrectas y no distingue si el correo existe', () => {
    const wrong = authErrorMessage(cognitoError('NotAuthorizedException', 'Incorrect username or password.'), 'x');
    expect(wrong).toBe('Correo o contraseña incorrectos.');
    expect(authErrorMessage(cognitoError('UserNotFoundException', 'User does not exist.'), 'x')).toBe(wrong);
  });

  it('reconoce el bloqueo por intentos', () => {
    expect(authErrorMessage(cognitoError('NotAuthorizedException', 'Password attempts exceeded'), 'x')).toMatch(/demasiados intentos/i);
  });

  it('deja solo el texto de la lambda de registro', () => {
    const err = cognitoError('UserLambdaValidationException', 'PreSignUp failed with error Este correo no está autorizado.');
    expect(authErrorMessage(err, 'x')).toBe('Este correo no está autorizado.');
  });

  it('muestra el motivo de rechazo cuando llega desde Google', () => {
    const err = cognitoError('OAuthError', 'PreSignUp failed with error Este correo no está autorizado.');
    expect(authErrorMessage(err, 'x')).toBe('Este correo no está autorizado.');
  });

  it('oculta en recuperación si la cuenta existe o es solo de Google', () => {
    expect(isHiddenAccountResetError(cognitoError('UserNotFoundException', 'x'))).toBe(true);
    expect(isHiddenAccountResetError(cognitoError('InvalidParameterException', 'x'))).toBe(true);
    expect(isHiddenAccountResetError(cognitoError('LimitExceededException', 'x'))).toBe(false);
    expect(isHiddenAccountResetError('raro')).toBe(false);
  });

  it('nunca muestra un error desconocido en crudo', () => {
    expect(authErrorMessage(new Error('Network down'), 'Error al iniciar sesión')).toBe('Error al iniciar sesión');
    expect(authErrorMessage('raro', 'Error al iniciar sesión')).toBe('Error al iniciar sesión');
    expect(authErrorMessage(cognitoError('UserLambdaValidationException', 'boom'), 'fallback')).toBe('fallback');
  });
});
