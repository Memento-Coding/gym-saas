/**
 * apiClient — Cliente HTTP base para la API REST de GymOps.
 *
 * Responsabilidades:
 *  - Construir URLs a partir de la base (API Gateway) + path + query params.
 *  - Adjuntar el JWT de Cognito en el header `Authorization: Bearer <token>`.
 *  - Serializar/deserializar JSON.
 *  - Normalizar errores de la API al tipo ApiError con status y mensaje.
 *
 * La obtención del token se inyecta como función (tokenProvider) para no acoplar
 * el cliente a Amplify/Cognito y permitir tests. En bypass de auth el provider
 * retorna undefined y no se envía header Authorization.
 *
 * @see gym-sass-infra/docs/API.md
 */

import { getApiBaseUrl } from '@/config/env';

/** Métodos HTTP soportados. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Valores admitidos como query params. */
export type QueryValue = string | number | boolean | undefined | null;

/** Opciones de una petición. */
export interface RequestOptions {
  /** Query params. Los valores undefined/null se omiten. */
  query?: Record<string, QueryValue>;
  /** Cuerpo JSON (se serializa automáticamente). */
  body?: unknown;
  /** Señal de aborto opcional. */
  signal?: AbortSignal;
}

/** Error estructurado de la API. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

/** Función que provee el token JWT actual (o undefined si no hay sesión). */
export type TokenProvider = () => Promise<string | undefined>;

/**
 * Provider de token por defecto: sin token. Se reemplaza en el arranque de la
 * app con el bridge de Cognito (ver setTokenProvider en authToken.ts).
 */
let tokenProvider: TokenProvider = async () => undefined;

/** Registra el provider de token JWT usado en todas las peticiones. */
export function setApiTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

/** Construye el querystring a partir de un objeto, omitiendo undefined/null. */
function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Ejecuta una petición HTTP contra la API y devuelve el JSON deserializado.
 *
 * @throws ApiError si la respuesta no es 2xx.
 */
export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}${buildQuery(options.query)}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = await tokenProvider();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (networkError) {
    throw new ApiError(
      0,
      networkError instanceof Error
        ? `Error de red al llamar ${method} ${normalizedPath}: ${networkError.message}`
        : 'Error de red desconocido.',
    );
  }

  // 204 No Content y respuestas sin cuerpo.
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? safeJsonParse(text) : undefined;

  if (!response.ok) {
    const message =
      (isRecord(payload) && typeof payload.error === 'string' && payload.error) ||
      `La API respondió ${response.status} en ${method} ${normalizedPath}.`;
    const detail =
      isRecord(payload) && typeof payload.detail === 'string'
        ? payload.detail
        : undefined;
    throw new ApiError(response.status, message, detail);
  }

  return payload as T;
}

/** Helpers de conveniencia por método. */
export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>('DELETE', path, options),
};

/** Parse JSON tolerante: devuelve el texto crudo si no es JSON válido. */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Type guard para objetos planos. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
