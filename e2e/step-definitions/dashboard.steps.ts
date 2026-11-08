/**
 * step-definitions/dashboard.steps.ts
 * Steps para: features/dashboard/panel-principal.feature
 */

import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { TEST_STUDENT } from '../fixtures/students';
import { diasDesdeHoy } from '../helpers/dates';
import { seedAll } from '../helpers/seed';

const erroresApp: string[] = [];

function estudiante(id: string, sobre: Record<string, unknown>) {
  return { ...TEST_STUDENT, id, documentId: id, consent: { ...TEST_STUDENT.consent, signed: true }, ...sobre };
}

Given('que hay un estudiante al día, uno por vencer, uno vencido y uno congelado', async ({ page }) => {
  await seedAll(page, {
    students: [
      estudiante('al-dia', { subscriptionEndDate: diasDesdeHoy(30) }),
      estudiante('por-vencer', { subscriptionEndDate: diasDesdeHoy(2) }),
      estudiante('vencido', { subscriptionEndDate: diasDesdeHoy(-3) }),
      estudiante('congelado', { subscriptionEndDate: diasDesdeHoy(40), status: 'frozen', freezeEndDate: diasDesdeHoy(20) }),
    ],
  });
});

Given(
  'que hay un ingreso de {int}, un egreso de {int} y un traslado de {int}',
  async ({ page }, ingreso: number, egreso: number, traslado: number) => {
    const fecha = diasDesdeHoy(0);
    const movimiento = (id: string, type: string, amount: number) => ({
      id, type, amount, date: fecha, concept: 'E2E', category: 'E2E', box: 'servicios',
    });
    await seedAll(page, {
      finance_movements: [
        movimiento('i', 'income', ingreso),
        movimiento('e', 'expense', egreso),
        movimiento('t', 'transfer', traslado),
      ],
    });
  },
);

Given('que hay un estudiante con la membresía vencida llamado {string}', async ({ page }, nombre: string) => {
  const [firstName, ...resto] = nombre.split(' ');
  await seedAll(page, {
    students: [estudiante('stu-alerta', { firstName, lastName: resto.join(' '), subscriptionEndDate: diasDesdeHoy(-3) })],
  });
});

Given(
  'que hay un estudiante con vencimiento {string} y nacimiento {string}',
  async ({ page }, vencimiento: string, nacimiento: string) => {
    await seedAll(page, { students: [estudiante('stu-danado', { subscriptionEndDate: vencimiento, dateOfBirth: nacimiento })] });
  },
);

When('accede al panel principal', async ({ page }) => {
  erroresApp.length = 0;
  page.on('pageerror', (e) => erroresApp.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

When('abre la alerta de {string}', async ({ page }, nombre: string) => {
  await page.getByText(nombre).first().click();
});

Then('la métrica {string} debería ser {int}', async ({ page }, metrica: string, valor: number) => {
  const tarjeta = page.locator('[data-slot="card"]').filter({ hasText: metrica }).first();
  await expect
    .poll(async () => Number((await tarjeta.locator('.metric-value').innerText()).replace(/\D/g, '') || '0'))
    .toBe(valor);
});

Then('debería ver que no hay alertas pendientes', async ({ page }) => {
  await expect(page.getByText(/no hay alertas pendientes/i)).toBeVisible();
});

Then('debería ver el perfil de {string}', async ({ page }, nombre: string) => {
  await expect(page).toHaveURL(/\/estudiantes\/stu-alerta$/);
  await expect(page.getByRole('heading', { name: nombre })).toBeVisible();
});

Then('debería ver el panel sin errores de la aplicación', async ({ page }) => {
  await page.waitForTimeout(500);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  expect(erroresApp).toEqual([]);
});
