/**
 * E2E — Tarea 23.1: CommunicationService
 * Req 12.1, 12.2, 12.3, 12.4, 12.5, 12.8
 */

import { test, expect } from '@playwright/test';
import { seedAll, TEST_STUDENT } from './helpers/seed';

test.describe('23.1 CommunicationService — canales y plantillas', () => {

  test('CommunicationPage carga y muestra los tres tabs (Req 12.1)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    await expect(page.getByRole('tab', { name: /plantillas/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /canales/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /enviar/i })).toBeVisible();
  });

  test('tab Plantillas muestra las 5 plantillas predeterminadas (Req 12.4)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    // Los títulos de las plantillas (CardTitle) — usar exact match para evitar strict mode
    await expect(page.getByText('Aviso de vencimiento próximo')).toBeVisible();
    await expect(page.getByText('Membresía vencida')).toBeVisible();
    await expect(page.getByText('Invitación a volver')).toBeVisible();
    await expect(page.getByText('Cuota pendiente de cartera')).toBeVisible();
    await expect(page.getByText('Feliz cumpleaños', { exact: true })).toBeVisible();
  });

  test('las plantillas contienen variables dinámicas {{nombre}} (Req 12.5)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    // Los textareas ya están visibles — el TemplateEditor los muestra expandidos por defecto
    const firstTextarea = page.getByRole('textbox').first();
    await expect(firstTextarea).toBeVisible();
    const value = await firstTextarea.inputValue();
    expect(value).toContain('{{nombre}}');
  });

  test('tab Canales muestra los tres canales con estado (Req 12.2, 12.3)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /canales/i }).click();

    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByText('Telegram')).toBeVisible();
    await expect(page.getByText('WhatsApp')).toBeVisible();
  });

  test('puede editar el texto de una plantilla y guardarlo (Req 12.8)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    // Los textareas ya están visibles — editar directamente el primero
    const firstTextarea = page.getByRole('textbox').first();
    await firstTextarea.fill('Hola {{nombre}}, texto E2E 23.1.');

    // Guardar — el botón se habilita cuando hay cambios
    await page.getByRole('button', { name: /guardar plantilla/i }).first().click();

    await expect(page.getByText('Hola {{nombre}}, texto E2E 23.1.')).toBeVisible();
  });
});
