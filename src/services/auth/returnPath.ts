const STORAGE_KEY = 'gymops.returnTo';

/** Solo rutas internas: `//evil.com` o `https://…` llevarían al usuario fuera de la app. */
export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/';
}

/** Google redirige fuera de la app y se pierde el estado de navegación. */
export function rememberReturnPath(path: string): void {
  sessionStorage.setItem(STORAGE_KEY, path);
}

export function peekReturnPath(): string | null {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  return saved === null ? null : safeReturnPath(saved);
}

export function clearReturnPath(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
