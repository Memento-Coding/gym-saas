export {
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

export type {
  AuthUser,
  SignInResult,
  SignUpResult,
  ResetPasswordResult,
} from './AuthService';

export { AuthProvider, useAuth } from './AuthProvider';
export type { AuthState, AuthActions, AuthContextValue, AuthProviderProps } from './AuthProvider';

export { ProtectedRoute } from './ProtectedRoute';
