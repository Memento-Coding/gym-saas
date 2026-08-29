/**
 * E2E — Tarea 24.1: CourtesyService y componentes
 * Req 13.1, 13.2, 13.3
 */

import { test, expect } from '@playwright/test';
import { seedAll, lsGet, TEST_STUDENT } from './helpers/seed';

const SUBSCRIPTION_END = '2025-12-31';

test.describe('24.1 CourtesyService — cortesías y bonos', () => {

  test('CourtesiesPage carga con encabezado y botón Nuevo bono', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/cortesias');
    await page.waitForLoadState('load');

    await expect(page.getByRole('heading', { name: /cortesías/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /nuevo bono/i })).toBeVisible();
  });

  test('sin bonos muestra estado vacío (Req 13.2)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/cortesias');
    await page.waitForLoadState('load');

    await expect(page.getByText(/no hay bonos/i)).toBeVisible();
  });

  test('abrir diálogo de nuevo bono muestra selector de estudiante (Req 13.1)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/cortesias');
    await page.waitForLoadState('load');

    await page.getByRole('button', { name: /nuevo bono/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('combobox')).toBeVisible();
  });

  test('registrar bono lo muestra agrupado por estudiante (Req 13.1, 13.2)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/cortesias');
    await page.waitForLoadState('load');

    await page.getByRole('button', { name: /nuevo bono/i }).click();

    // El Radix Select: click en trigger, luego en la opción (role=option)
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: /Ana García/i }).click();

    await page.getByLabel(/fecha de inicio/i).fill('2025-03-01');
    await page.getByLabel(/duración/i).fill('2');
    await page.getByLabel(/razón/i).fill('Compensación por cierre E2E');
    await page.getByRole('dialog').getByRole('button', { name: /registrar/i }).click();

    // El bono queda agrupado bajo el nombre del estudiante
    const group = page.locator('div').filter({ hasText: 'Compensación por cierre E2E' }).first();
    await expect(group.getByText('Ana García')).toBeVisible();
    await expect(page.getByText('Compensación por cierre E2E')).toBeVisible();
  });

  test('bono NO modifica la fecha de vencimiento de membresía (Req 13.3)', async ({ page }) => {
    await seedAll(page, { students: [{ ...TEST_STUDENT, subscriptionEndDate: SUBSCRIPTION_END }] });
    await page.goto('/cortesias');
    await page.waitForLoadState('load');

    await page.getByRole('button', { name: /nuevo bono/i }).click();
    await page.getByRole('dialog').getByRole('combobox').click();
    await page.getByRole('option', { name: /Ana García/i }).click();
    await page.getByLabel(/fecha de inicio/i).fill('2025-03-01');
    await page.getByLabel(/duración/i).fill('4');
    await page.getByLabel(/razón/i).fill('Cortesía especial E2E');
    await page.getByRole('dialog').getByRole('button', { name: /registrar/i }).click();

    // La app hace dual-write → localStorage refleja el estado final
    const students = await lsGet<Array<{ subscriptionEndDate: string }>>(page, 'students');
    expect(students?.[0]?.subscriptionEndDate).toBe(SUBSCRIPTION_END);
  });

  test('muestra badge Activo para bono con fecha futura (Req 13.2)', async ({ page }) => {
    const futureEnd = new Date(Date.now() + 14 * 86_400_000).toISOString().split('T')[0];
    await seedAll(page, {
      students: [{
        ...TEST_STUDENT,
        courtesyBonuses: [{
          id: 'bonus-e2e-001',
          startDate: new Date().toISOString().split('T')[0],
          endDate: futureEnd,
          reason: 'Bono activo E2E',
          weeks: 2,
        }],
      }],
    });

    await page.goto('/cortesias');
    await page.waitForLoadState('load');

    await expect(page.getByText('Bono activo E2E')).toBeVisible();
    // exact: true para no coincidir con "Activos" (stats card) ni "Bono activo E2E"
    await expect(page.getByText('Activo', { exact: true })).toBeVisible();
  });

  test('eliminar bono lo quita de la lista (Req 13.2)', async ({ page }) => {
    await seedAll(page, {
      students: [{
        ...TEST_STUDENT,
        courtesyBonuses: [{
          id: 'bonus-del-e2e',
          startDate: '2025-01-01',
          endDate: '2025-01-15',
          reason: 'Bono a eliminar E2E',
          weeks: 2,
        }],
      }],
    });

    await page.goto('/cortesias');
    await page.waitForLoadState('load');

    await expect(page.getByText('Bono a eliminar E2E')).toBeVisible();
    // El botón de eliminar tiene title="Eliminar bono"
    await page.getByTitle(/eliminar bono/i).first().click();
    await expect(page.getByText('Bono a eliminar E2E')).not.toBeVisible();
  });
});
