import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./AuthService', () => ({
  getCurrentUser: vi.fn(),
  getAccessToken: vi.fn(),
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
}));

import {
  getCurrentUser,
  getAccessToken,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  confirmSignUp,
} from './AuthService';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetAccessToken = vi.mocked(getAccessToken);
const mockSignIn = vi.mocked(signIn);
const mockSignInWithGoogle = vi.mocked(signInWithGoogle);
const mockSignOut = vi.mocked(signOut);
const mockSignUp = vi.mocked(signUp);
const mockConfirmSignUp = vi.mocked(confirmSignUp);

// ─── Test helper component ─────────────────────────────────────────────────────

function TestConsumer() {
  const { user, isLoading, isAuthenticated, login, logout, register, confirmRegistration, refreshSession, loginWithGoogle } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user-name">{user?.username ?? 'none'}</span>
      <span data-testid="user-email">{user?.email ?? 'none'}</span>
      <button onClick={() => login('test@example.com', 'password123')}>Login</button>
      <button onClick={() => loginWithGoogle()}>Google</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => register('new@example.com', 'pass123')}>Register</button>
      <button onClick={() => confirmRegistration('new@example.com', '123456')}>Confirm</button>
      <button onClick={() => refreshSession()}>Refresh</button>
    </div>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially and resolves to unauthenticated when no session', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('No current user'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Initially loading
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user-name')).toHaveTextContent('none');
  });

  it('resolves to authenticated when a valid session exists', async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: 'user-1',
      username: 'John Doe',
      email: 'john@example.com',
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
    expect(screen.getByTestId('user-email')).toHaveTextContent('john@example.com');
  });

  it('login action updates user state on success', async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error('No session'));
    mockSignIn.mockResolvedValue({ isSignedIn: true });
    mockGetCurrentUser.mockResolvedValue({
      userId: 'user-2',
      username: 'Jane',
      email: 'jane@example.com',
    });

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('user-name')).toHaveTextContent('Jane');
    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('login action does not update user when isSignedIn is false', async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error('No session'));
    mockSignIn.mockResolvedValue({ isSignedIn: false, nextStep: 'CONFIRM_SIGN_UP' });

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled();
    });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('logout action clears user state', async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: 'user-1',
      username: 'John',
      email: 'john@example.com',
    });
    mockSignOut.mockResolvedValue(undefined);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    await user.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('user-name')).toHaveTextContent('none');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('register action calls signUp', async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error('No session'));
    mockSignUp.mockResolvedValue({ isSignUpComplete: false, nextStep: 'CONFIRM_SIGN_UP' });

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'pass123');
    });
  });

  it('confirmRegistration action calls confirmSignUp', async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error('No session'));
    mockConfirmSignUp.mockResolvedValue({ isSignUpComplete: true });

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockConfirmSignUp).toHaveBeenCalledWith('new@example.com', '123456');
    });
  });

  it('refreshSession calls getAccessToken and updates user', async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: 'user-1',
      username: 'John',
      email: 'john@example.com',
    });
    mockGetAccessToken.mockResolvedValue('new-token');

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetAccessToken).toHaveBeenCalled();
    });
  });

  it('loginWithGoogle calls signInWithGoogle', async () => {
    mockGetCurrentUser.mockRejectedValueOnce(new Error('No session'));
    mockSignInWithGoogle.mockResolvedValue(undefined);

    const user = userEvent.setup();

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByText('Google'));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
  });
});

describe('useAuth', () => {
  it('throws error when used outside AuthProvider', () => {
    // Suppress console.error for this test since React will log the error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});
