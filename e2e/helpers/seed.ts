/**
 * seed.ts — Helpers de datos de prueba para E2E.
 *
 * La app corre con VITE_E2E_STORAGE=localStorage, lo que fuerza a
 * StorageService a usar LocalStorageAdapter como primary.
 * Los tests solo necesitan sembrar datos en localStorage antes del goto.
 */

import type { Page } from '@playwright/test';

const LS_PREFIX = 'gymops:';

/**
 * Siembra datos en localStorage usando addInitScript.
 * Con VITE_E2E_STORAGE=localStorage, la app usa LocalStorageAdapter como
 * primary, por lo que los datos sembrados serán leídos directamente.
 *
 * También resetea el singleton de StorageService para que la próxima
 * llamada a getStorageService() cree una instancia fresca.
 *
 * Debe llamarse ANTES de page.goto().
 */
export async function seedAll(page: Page, data: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ({ lsPrefix, entries }: { lsPrefix: string; entries: Record<string, unknown> }) => {
      for (const [key, value] of Object.entries(entries)) {
        try {
          localStorage.setItem(lsPrefix + key, JSON.stringify(value));
        } catch { /* quota */ }
      }
      const win = window as Window & { __resetStorage?: () => void };
      if (typeof win.__resetStorage === 'function') {
        win.__resetStorage();
      }
    },
    { lsPrefix: LS_PREFIX, entries: data },
  );
}

/**
 * Lee un valor de localStorage (gymops: prefix).
 */
export async function lsGet<T>(page: Page, key: string): Promise<T | null> {
  return page.evaluate(
    ([prefix, k]) => {
      const raw = localStorage.getItem(prefix + k);
      return raw ? JSON.parse(raw) : null;
    },
    [LS_PREFIX, key] as const,
  ) as Promise<T | null>;
}
