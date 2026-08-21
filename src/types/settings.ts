/**
 * Tipos para el módulo de configuración y ajustes.
 * Define branding, campos dinámicos, metadatos y autenticación.
 */

export interface BrandingConfig {
  logo: string | null;
  wordmark: string | null;
  tagline: string | null;
}

export interface FormFieldConfig {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required: boolean;
  options?: string[];
  isBuiltIn: boolean;
}

export interface AppMeta {
  seq: number;
}

export interface AuthConfig {
  userPoolId: string;
  userPoolClientId: string;
  region: string;
  oauthDomain: string;
  redirectSignIn: string;
  redirectSignOut: string;
}
