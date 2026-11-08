import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Hub } from 'aws-amplify/utils';

import { AuthProvider, useAuth } from './AuthProvider';
import { getCurrentUser, recordTermsAcceptance } from './AuthService';

vi.mock('./AuthService', () => ({
  getCurrentUser: vi.fn().mockRejectedValue(new Error('sin sesión')),
  recordTermsAcceptance: vi.fn(),
}));

function Probe() {
  const { oauthError, clearOAuthError } = useAuth();
  return (
    <button onClick={clearOAuthError}>
      {oauthError instanceof Error ? oauthError.message : 'sin error'}
    </button>
  );
}

const fail = (message: string) =>
  Hub.dispatch('auth', { event: 'signInWithRedirect_failure', data: { error: new Error(message) as never } });

describe('fallo al volver de Google', () => {
  it('conserva el error emitido antes de montar y se puede limpiar', async () => {
    fail('antes de montar');
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('antes de montar')).toBeInTheDocument();

    act(() => screen.getByRole('button').click());
    expect(screen.getByText('sin error')).toBeInTheDocument();
  });

  it('muestra el error emitido con la app ya montada', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    act(() => fail('después de montar'));
    expect(await screen.findByText('después de montar')).toBeInTheDocument();
  });
});

describe('aceptación de términos con Google', () => {
  const KEY = 'gymops.termsPending';
  const record = vi.mocked(recordTermsAcceptance);
  const signedIn = (termsAccepted?: string) =>
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: 'u', username: 'u', termsAccepted });
  const mount = () => render(<AuthProvider><Probe /></AuthProvider>);
  const settled = () => waitFor(() => expect(vi.mocked(getCurrentUser)).toHaveBeenCalled());

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    record.mockResolvedValue(undefined);
  });

  it('guarda al volver del login con Google si la cuenta no consta', async () => {
    sessionStorage.setItem(KEY, '1');
    signedIn();
    mount();
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sessionStorage.getItem(KEY)).toBeNull());
  });

  it('no toca una sesión ya abierta', async () => {
    signedIn();
    mount();
    await settled();
    await act(async () => {});
    expect(record).not.toHaveBeenCalled();
  });

  it('no sobrescribe una aceptación existente', async () => {
    sessionStorage.setItem(KEY, '1');
    signedIn('v1|2026-01-01T00:00:00Z');
    mount();
    await waitFor(() => expect(sessionStorage.getItem(KEY)).toBeNull());
    expect(record).not.toHaveBeenCalled();
  });

  it('si falla no bloquea y conserva la marca para reintentar', async () => {
    sessionStorage.setItem(KEY, '1');
    record.mockRejectedValue(new Error('invalid_scope'));
    signedIn();
    mount();
    await waitFor(() => expect(record).toHaveBeenCalled());
    await act(async () => {});
    expect(sessionStorage.getItem(KEY)).toBe('1');
  });

  it('un rechazo de Google borra la marca', () => {
    sessionStorage.setItem(KEY, '1');
    fail('rechazado');
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
