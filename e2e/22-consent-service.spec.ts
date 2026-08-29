/**
 * E2E — Tarea 22.1: ConsentService
 * Req 6.1, 6.2, 6.3, 6.5, 6.7
 */

import { test, expect } from '@playwright/test';
import { seedAll, TEST_STUDENT, TEST_MINOR_STUDENT } from './helpers/seed';

const DEFAULT_CONSENT = {
  version: 1,
  updatedDate: new Date().toISOString(),
  text: 'Texto de consentimiento para adultos.',
  minorText: 'Texto de consentimiento para menores.',
};

test.describe('22.1 ConsentService — módulo de consentimiento', () => {

  test('muestra la versión actual del consentimiento y los textos configurados (Req 6.1, 6.2)', async ({ page }) => {
    await seedAll(page, {
      consent_config: {
        version: 3,
        updatedDate: new Date().toISOString(),
        text: 'Consentimiento adulto versión 3.',
        minorText: 'Consentimiento menor versión 3.',
      },
      students: [TEST_STUDENT],
    });

    await page.goto('/consentimiento');
    await page.waitForLoadState('load');

    await expect(page.getByRole('paragraph').filter({ hasText: 'v3' })).toBeVisible();
    await expect(page.getByText('Consentimiento adulto versión 3.')).toBeVisible();
  });

  test('muestra estudiante pendiente de firma cuando consent.signed = false (Req 6.3)', async ({ page }) => {
    await seedAll(page, {
      consent_config: DEFAULT_CONSENT,
      students: [{ ...TEST_STUDENT, consent: { signed: false, signedDate: '', signedVersion: 0, signature: '', mediaAuth: false, byGuardian: false } }],
    });

    await page.goto('/consentimiento');
    await page.waitForLoadState('load');

    await expect(page.getByText('Ana García')).toBeVisible();
    await expect(page.getByRole('button', { name: /firmar/i })).toBeVisible();
  });

  test('no muestra estudiantes en pendientes cuando todos tienen firma vigente', async ({ page }) => {
    await seedAll(page, {
      consent_config: { version: 1, updatedDate: new Date().toISOString(), text: 'T', minorText: 'TM' },
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

    await expect(page.getByText(/todos los estudiantes han firmado/i)).toBeVisible();
  });

  test('actualizar versión deja al estudiante como pendiente (Req 6.3)', async ({ page }) => {
    await seedAll(page, {
      consent_config: { version: 1, updatedDate: new Date().toISOString(), text: 'Texto v1', minorText: 'Menor v1' },
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

    // El estudiante firmado no está en pendientes aún
    await expect(page.getByText(/todos los estudiantes han firmado/i)).toBeVisible();

    // Abrir editor y guardar nueva versión
    await page.getByRole('button', { name: /editar/i }).click();
    const textarea = page.getByRole('textbox').first();
    await textarea.fill('Texto v2 actualizado E2E');
    await page.getByRole('button', { name: /guardar nueva versión|actualizar/i }).click();

    // Ana debe aparecer ahora en pendientes
    await expect(page.getByText('Ana García')).toBeVisible();
  });

  test('estudiante menor muestra botón Diferir además de Firmar (Req 6.5)', async ({ page }) => {
    await seedAll(page, {
      consent_config: DEFAULT_CONSENT,
      students: [TEST_MINOR_STUDENT],
    });

    await page.goto('/consentimiento');
    await page.waitForLoadState('load');

    await expect(page.getByText('Luis Pérez')).toBeVisible();
    await expect(page.getByRole('button', { name: /diferir/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /firmar/i })).toBeVisible();
  });
});
