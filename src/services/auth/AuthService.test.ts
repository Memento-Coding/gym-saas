/**
 * Tests para AuthService — wrapper sobre AWS Amplify v6 Auth.
 * Valida que las funciones delegan correctamente a Amplify.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de aws-amplify
vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: vi.fn(),
  },
}));

vi.mock('aws-amplify/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  signOut: vi.fn(),
  getCurrentUser: vi.fn(),
  fetchAuthSession: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
  signInWithRedirect: vi.fn(),
}));

import { Amplify } from 'aws-amplify';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signOut as amplifySignOut,
  getCurrentUser as amplifyGetCurrentUser,
  fetchAuthSession,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
  signInWithRedirect,
} from 'aws-amplify/auth';

import {
  configureAuth,
  signIn,
  signInWithGoogle,
  signUp,
  confirmSignUp,
  signOut,
  getCurrentUser,
  getAccessToken,
  resetPassword,
  confirmResetPassword,
} from './AuthService';

import type { AuthConfig } from '@/types/settings';

const mockConfig: AuthConfig = {
  userPoolId: 'us-east-1_TestPool',
  userPoolClientId: 'test-client-id',
  region: 'us-east-1',
  oauthDomain: 'auth.example.com',
  redirectSignIn: 'http://localhost:3000/',
  redirectSignOut: 'http://localhost:3000/login',
};

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configureAuth', () => {
    it('should call Amplify.configure with correct Cognito config', () => {
      configureAuth(mockConfig);

      expect(Amplify.configure).toHaveBeenCalledWith({
        Auth: {
          Cognito: {
            userPoolId: 'us-east-1_TestPool',
            userPoolClientId: 'test-client-id',
            loginWith: {
              oauth: {
                domain: 'auth.example.com',
                scopes: ['openid', 'email', 'profile'],
                redirectSignIn: ['http://localhost:3000/'],
                redirectSignOut: ['http://localhost:3000/login'],
                responseType: 'code',
              },
            },
          },
        },
      });
    });
  });

  describe('signIn', () => {
    it('should call amplifySignIn with email and password and return result', async () => {
      vi.mocked(amplifySignIn).mockResolvedValue({
        isSignedIn: true,
        nextStep: { signInStep: 'DONE' },
      } as ReturnType<typeof amplifySignIn> extends Promise<infer R> ? R : never);

      const result = await signIn('user@test.com', 'password123');

      expect(amplifySignIn).toHaveBeenCalledWith({
        username: 'user@test.com',
        password: 'password123',
      });
      expect(result).toEqual({
        isSignedIn: true,
        nextStep: 'DONE',
      });
    });

    it('should handle MFA step', async () => {
      vi.mocked(amplifySignIn).mockResolvedValue({
        isSignedIn: false,
        nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_SMS_MFA_CODE' },
      } as unknown as ReturnType<typeof amplifySignIn> extends Promise<infer R> ? R : never);

      const result = await signIn('user@test.com', 'password123');

      expect(result).toEqual({
        isSignedIn: false,
        nextStep: 'CONFIRM_SIGN_IN_WITH_SMS_MFA_CODE',
      });
    });
  });

  describe('signInWithGoogle', () => {
    it('should call signInWithRedirect with Google provider', async () => {
      vi.mocked(signInWithRedirect).mockResolvedValue(undefined);

      await signInWithGoogle();

      expect(signInWithRedirect).toHaveBeenCalledWith({ provider: 'Google' });
    });
  });

  describe('signUp', () => {
    it('should call amplifySignUp with email, password, and user attributes', async () => {
      vi.mocked(amplifySignUp).mockResolvedValue({
        isSignUpComplete: false,
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
        userId: 'new-user-id',
      } as ReturnType<typeof amplifySignUp> extends Promise<infer R> ? R : never);

      const result = await signUp('new@test.com', 'securePass1!');

      expect(amplifySignUp).toHaveBeenCalledWith({
        username: 'new@test.com',
        password: 'securePass1!',
        options: {
          userAttributes: { email: 'new@test.com' },
        },
      });
      expect(result).toEqual({
        isSignUpComplete: false,
        nextStep: 'CONFIRM_SIGN_UP',
      });
    });
  });

  describe('confirmSignUp', () => {
    it('should call amplifyConfirmSignUp with email and code', async () => {
      vi.mocked(amplifyConfirmSignUp).mockResolvedValue({
        isSignUpComplete: true,
        nextStep: { signUpStep: 'DONE' },
      } as ReturnType<typeof amplifyConfirmSignUp> extends Promise<infer R> ? R : never);

      const result = await confirmSignUp('new@test.com', '123456');

      expect(amplifyConfirmSignUp).toHaveBeenCalledWith({
        username: 'new@test.com',
        confirmationCode: '123456',
      });
      expect(result).toEqual({
        isSignUpComplete: true,
        nextStep: 'DONE',
      });
    });
  });

  describe('signOut', () => {
    it('should call amplifySignOut', async () => {
      vi.mocked(amplifySignOut).mockResolvedValue(undefined);

      await signOut();

      expect(amplifySignOut).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user info from amplifyGetCurrentUser', async () => {
      vi.mocked(amplifyGetCurrentUser).mockResolvedValue({
        userId: 'user-123',
        username: 'user@test.com',
        signInDetails: {
          loginId: 'user@test.com',
          authFlowType: 'USER_SRP_AUTH',
        },
      });

      const user = await getCurrentUser();

      expect(user).toEqual({
        userId: 'user-123',
        username: 'user@test.com',
        email: 'user@test.com',
      });
    });

    it('should handle user without signInDetails', async () => {
      vi.mocked(amplifyGetCurrentUser).mockResolvedValue({
        userId: 'user-456',
        username: 'google-user',
      } as ReturnType<typeof amplifyGetCurrentUser> extends Promise<infer R> ? R : never);

      const user = await getCurrentUser();

      expect(user).toEqual({
        userId: 'user-456',
        username: 'google-user',
        email: undefined,
      });
    });
  });

  describe('getAccessToken', () => {
    it('should return access token from session', async () => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: {
          accessToken: { toString: () => 'mock-access-token-jwt' },
        },
      } as ReturnType<typeof fetchAuthSession> extends Promise<infer R> ? R : never);

      const token = await getAccessToken();

      expect(fetchAuthSession).toHaveBeenCalledWith({ forceRefresh: false });
      expect(token).toBe('mock-access-token-jwt');
    });

    it('should return undefined when no tokens available', async () => {
      vi.mocked(fetchAuthSession).mockResolvedValue({
        tokens: undefined,
      } as ReturnType<typeof fetchAuthSession> extends Promise<infer R> ? R : never);

      const token = await getAccessToken();

      expect(token).toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('should call amplifyResetPassword and return result', async () => {
      vi.mocked(amplifyResetPassword).mockResolvedValue({
        isPasswordReset: false,
        nextStep: {
          resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE',
          codeDeliveryDetails: {
            deliveryMedium: 'EMAIL',
            destination: 'u***@test.com',
          },
        },
      } as ReturnType<typeof amplifyResetPassword> extends Promise<infer R> ? R : never);

      const result = await resetPassword('user@test.com');

      expect(amplifyResetPassword).toHaveBeenCalledWith({
        username: 'user@test.com',
      });
      expect(result).toEqual({
        isPasswordReset: false,
        nextStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE',
      });
    });
  });

  describe('confirmResetPassword', () => {
    it('should call amplifyConfirmResetPassword with all params', async () => {
      vi.mocked(amplifyConfirmResetPassword).mockResolvedValue(undefined);

      await confirmResetPassword('user@test.com', '654321', 'newPass123!');

      expect(amplifyConfirmResetPassword).toHaveBeenCalledWith({
        username: 'user@test.com',
        confirmationCode: '654321',
        newPassword: 'newPass123!',
      });
    });
  });
});
