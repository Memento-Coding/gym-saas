/**
 * seed.ts — Helpers de datos de prueba para E2E.
 *
 * La app corre con VITE_E2E_STORAGE=localStorage, lo que fuerza a
 * StorageService a usar LocalStorageAdapter como primary.
 * Los tests solo necesitan sembrar datos en localStorage antes del goto.
 */

import type { Page } from '@playwright/test';

const LS_PREFIX = 'gymops:';

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const TEST_STUDENT = {
  id: 'stu-e2e-001',
  photo: '',
  firstName: 'Ana',
  lastName: 'García',
  documentId: '1234567890',
  isMinor: false,
  guardianName: '',
  guardianDocument: '',
  phone: '3001234567',
  email: 'ana.garcia@test.com',
  emergencyName: 'Carlos García',
  emergencyPhone: '3009876543',
  emergencyRelation: 'Padre',
  dateOfBirth: '1995-06-15',
  bloodType: 'O+',
  firstRegistrationDate: '2024-01-01',
  recentRegistrationDate: '2024-01-01',
  registrationDate: '2024-01-01',
  subscriptionEndDate: '2025-12-31',
  monthlyFee: 95000,
  planCategory: 'mensualidad',
  planName: 'Estándar',
  planId: 'standard',
  payments: [],
  courtesyBonuses: [],
  medicalNotes: '',
  status: 'active',
  beltRank: 'Blanco',
  telegramChatId: '',
  consent: {
    signed: false,
    signedDate: '',
    signedVersion: 0,
    signature: '',
    mediaAuth: false,
    byGuardian: false,
  },
  customFields: {},
};

export const TEST_MINOR_STUDENT = {
  ...TEST_STUDENT,
  id: 'stu-e2e-002',
  firstName: 'Luis',
  lastName: 'Pérez',
  documentId: '9876543210',
  isMinor: true,
  guardianName: 'María Pérez',
  guardianDocument: '111222333',
  dateOfBirth: '2012-03-20',
};

// ── Core ──────────────────────────────────────────────────────────────────────

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
export async function seedAll(page: Page, data: Record<string, unknown>) {
  await page.addInitScript(
    ({ lsPrefix, entries }: { lsPrefix: string; entries: Record<string, unknown> }) => {
      // Sembrar localStorage síncronamente — el StorageService leerá estos datos
      for (const [key, value] of Object.entries(entries)) {
        try {
          localStorage.setItem(lsPrefix + key, JSON.stringify(value));
        } catch { /* quota */ }
      }

      // Resetear el singleton de StorageService para forzar re-inicialización
      // Se expone via window.__resetStorage desde main.tsx en DEV mode
      const win = window as Window & { __resetStorage?: () => void };
      if (typeof win.__resetStorage === 'function') {
        win.__resetStorage();
      }
    },
    { lsPrefix: LS_PREFIX, entries: data },
  );
}

/** No-op: el reset ahora ocurre en addInitScript */
export async function resetStorageSingleton(_page: Page) {
  // El reset ahora se hace en el addInitScript para garantizar el orden correcto
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
