/**
 * E2E — Tarea 23.3: Componentes de comunicación
 * Req 12.4, 12.6, 12.9, 12.10, 12.12
 */

import { test, expect } from '@playwright/test';
import { seedAll, TEST_STUDENT } from './helpers/seed';

test.describe('23.3 Componentes de comunicación', () => {

  test('TemplateEditor: editar textarea y guardar persiste el texto (Req 12.6)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    // Los textareas están visibles sin necesidad de botón Editar
    const firstTextarea = page.getByRole('textbox').first();
    await firstTextarea.fill('Mensaje de prueba {{nombre}} E2E componente.');
    await page.getByRole('button', { name: /guardar plantilla/i }).first().click();

    await expect(page.getByText('Mensaje de prueba {{nombre}} E2E componente.')).toBeVisible();
  });

  test('ChannelSelector: muestra controles para activar/desactivar canales (Req 12.3)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /canales/i }).click();

    const toggles = page.getByRole('checkbox');
    expect(await toggles.count()).toBeGreaterThanOrEqual(1);
  });

  test('tab Enviar: muestra selector de plantilla y estudiante en lista (Req 12.9)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /enviar/i }).click();

    await expect(page.getByRole('combobox', { name: /plantilla/i })).toBeVisible();
    await expect(page.getByText('Ana García')).toBeVisible();
  });

  test('seleccionar todos cambia el texto del botón (Req 12.9)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /enviar/i }).click();
    await page.getByRole('button', { name: /seleccionar todos/i }).click();
    await expect(page.getByRole('button', { name: /deseleccionar todos/i })).toBeVisible();
  });

  test('botón Enviar deshabilitado sin plantilla seleccionada (Req 12.9)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /enviar/i }).click();

    const sendBtn = page.getByRole('button', { name: /enviar a/i });
    await expect(sendBtn).toBeDisabled();
  });

  test('MessagePreview: seleccionar plantilla muestra botón de vista previa (Req 12.8)', async ({ page }) => {
    await seedAll(page, { students: [TEST_STUDENT] });
    await page.goto('/comunicacion');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /enviar/i }).click();

    // Seleccionar plantilla "Aviso de vencimiento"
    await page.getByRole('combobox', { name: /plantilla/i }).click();
    await page.getByRole('option', { name: /aviso de vencimiento/i }).click();

    // Con plantilla seleccionada aparece el botón "Vista previa" junto a cada estudiante
    await expect(page.getByRole('button', { name: /previsualizar/i }).first()).toBeVisible();
    await page.getByRole('button', { name: /previsualizar/i }).first().click();

    // El MessagePreview muestra el nombre del estudiante resuelto
    await expect(page.getByText('Para:', { exact: true }).locator('..')).toContainText('Ana García');
  });
});
