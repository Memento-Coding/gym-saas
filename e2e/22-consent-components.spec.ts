/**
 * E2E — Tarea 22.3: Componentes de consentimiento
 * Req 6.1, 6.4, 6.6
 */

import { test, expect } from '@playwright/test';
import { seedAll, TEST_STUDENT } from './helpers/seed';

const DEFAULT_CONSENT = {
  version: 1,
  updatedDate: new Date().toISOString(),
  text: 'Texto adulto E2E.',
  minorText: 'Texto menor E2E.',
};

test.describe('22.3 Componentes de consentimiento', () => {

  test('ConsentPage carga y muestra encabezado y stats cards', async ({ page }) => {
    await seedAll(page, { consent_config: DEFAULT_CONSENT, students: [TEST_STUDENT] });
    await page.goto('/consentimiento');
    await page.waitForLoadState('load');

    await expect(page.getByRole('heading', { name: /consentimiento/i })).toBeVisible();
    await expect(page.getByText("Versión actual", { exact: true })).toBeVisible();
    await expect(page.getByText('Pendientes', { exact: true })).toBeVisible();
  });

  test('ConsentViewer muestra tab Adultos y tab Menores con textos separados (Req 6.1)', async ({ page }) => {
    await seedAll(page, { consent_config: DEFAULT_CONSENT, students: [TEST_STUDENT] });
    await page.goto('/consentimiento');
    await page.waitForLoadState('load');

    await expect(page.getByRole('tab', { name: /adultos/i })).toBeVisible();
    await expect(page.getByText('Texto adulto E2E.')).toBeVisible();

    await page.getByRole('tab', { name: /menores/i }).click();
    await expect(page.getByText('Texto menor E2E.')).toBeVisible();
  });

  test('botón Editar abre el formulario de edición de texto (Req 6.1)', async ({ page }) => {
    await seedAll(page, { consent_config: DEFAULT_CONSENT, students: [TEST_STUDENT] });
    await page.goto('/consentimiento');
    await page.waitForLoadState('load');

    await page.getByRole('button', { name: /editar/i }).click();
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('abrir diálogo de firma muestra el canvas de SignatureCanvas (Req 6.4)', async ({ page }) => {
    await seedAll(page, { consent_config: DEFAULT_CONSENT, students: [TEST_STUDENT] });
    await page.goto('/consentimiento');
    await page.waitForLoadState('load');

    await page.getByRole('button', { name: /firmar/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('estudiante con firma previa muestra botón de descarga PDF (Req 6.6)', async ({ page }) => {
    await seedAll(page, {
      consent_config: { version: 2, updatedDate: new Date().toISOString(), text: 'T', minorText: 'TM' },
      students: [{
        ...TEST_STUDENT,
        consent: {
          signed: true,
          signedDate: new Date().toISOString(),
          signedVersion: 1,
          signature: 'data:image/png;base64,abc',
          mediaAuth: false,
          byGuardian: false,
        },
      }],
    });
    await page.goto('/consentimiento');
    await page.waitForLoadState('load');

    await expect(page.getByTitle(/descargar PDF/i)).toBeVisible();
  });
});
