/**
 * support/world.ts
 *
 * Define el fixture personalizado de playwright-bdd.
 *
 * Variables de entorno:
 *   SLOW_STEP_MS  — pausa en ms después de cada acción individual del browser
 *                   (usa slowMo de Playwright internamente).
 *                   Ejemplo: SLOW_STEP_MS=2000 npm run bdd:headed
 */

import { test as base, createBdd } from 'playwright-bdd';
import { seedAll, lsGet } from '../helpers/seed';

export type GymWorld = {
  seedAll: (data: Record<string, unknown>) => Promise<void>;
  lsGet: <T>(key: string) => Promise<T | null>;
  /** Pausa explícita usable dentro de un step: await pause() */
  pause: () => Promise<void>;
};

export const test = base.extend<GymWorld>({
  seedAll: async ({ page }, use) => {
    await use((data) => seedAll(page, data));
  },
  lsGet: async ({ page }, use) => {
    await use(<T>(key: string) => lsGet<T>(page, key));
  },
  pause: async ({ page }, use) => {
    const delay = parseInt(process.env.SLOW_STEP_MS ?? '0', 10);
    await use(() =>
      delay > 0 ? page.waitForTimeout(delay) : Promise.resolve(),
    );
  },
});

export const { Given, When, Then, Before, After } = createBdd(test);
