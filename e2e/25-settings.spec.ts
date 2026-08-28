/**
 * E2E — Tarea 25.1: SettingsPage y componentes
 * Req 15.1 – 15.9
 */

import { test, expect } from '@playwright/test';
import { seedAll, lsGet } from './helpers/seed';

test.describe('25.1 SettingsPage — configuración y personalización', () => {

  test('SettingsPage carga con los 5 tabs de configuración', async ({ page }) => {
    await page.goto('/ajustes');
    await page.waitForLoadState('load');

    await expect(page.getByRole('tab', { name: /marca/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /planes/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /formulario/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /backup/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /comunicación/i })).toBeVisible();
  });

  // ── BrandingForm (Req 15.1) ────────────────────────────────────────────────

  test('BrandingForm: guardar wordmark y tagline persiste en storage (Req 15.1)', async ({ page }) => {
    await page.goto('/ajustes');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /marca/i }).click();
    await page.getByLabel(/wordmark|nombre/i).fill('Meraki Academy E2E');
    await page.getByLabel(/tagline|eslogan/i).fill('Entrena con propósito E2E');
    await page.getByRole('button', { name: /guardar marca/i }).click();

    await expect(page.getByText(/configuración de marca guardada/i)).toBeVisible();

    const branding = await lsGet<{ wordmark: string; tagline: string }>(page, 'branding');
    expect(branding?.wordmark).toBe('Meraki Academy E2E');
    expect(branding?.tagline).toBe('Entrena con propósito E2E');
  });

  // ── FormFieldConfig (Req 15.6 – 15.9) ─────────────────────────────────────

  test('FormFieldConfig: agregar campo personalizado lo muestra en la lista (Req 15.7)', async ({ page }) => {
    await page.goto('/ajustes');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /formulario/i }).click();
    await page.getByRole('button', { name: /agregar campo/i }).click();
    await page.getByPlaceholder(/nombre del campo/i).fill('Talla de kimono E2E');
    await page.getByRole('button', { name: /^agregar$/i }).click();

    await expect(page.getByText('Talla de kimono E2E')).toBeVisible();
  });

  test('FormFieldConfig: campos pre-existentes aparecen en la lista (Req 15.6)', async ({ page }) => {
    await seedAll(page, {
      formFields: [{
        id: 'field-e2e-001',
        name: 'nivel_cinturon',
        label: 'Nivel Cinturón E2E',
        type: 'text',
        required: false,
        isBuiltIn: false,
      }],
    });

    await page.goto('/ajustes');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /formulario/i }).click();
    await expect(page.getByText('Nivel Cinturón E2E')).toBeVisible();
  });

  test('FormFieldConfig: eliminar campo requiere confirmación en diálogo (Req 15.9)', async ({ page }) => {
    await seedAll(page, {
      formFields: [{
        id: 'field-del-e2e',
        name: 'campo_borrar',
        label: 'Campo a Borrar E2E',
        type: 'text',
        required: false,
        isBuiltIn: false,
      }],
    });

    await page.goto('/ajustes');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /formulario/i }).click();
    await expect(page.getByText('Campo a Borrar E2E')).toBeVisible();

    // El botón de Trash2 no tiene texto visible — es el segundo botón de acción en la fila del campo
    const fieldRow = page.getByText('Campo a Borrar E2E').locator('..').locator('..');
    await fieldRow.getByRole('button').nth(1).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /eliminar/i }).click();

    await expect(page.getByText('Campo a Borrar E2E')).not.toBeVisible();
  });

  // ── BackupManager (Req 15.2 – 15.5) ──────────────────────────────────────

  test('BackupManager: botón de exportar está presente (Req 15.2)', async ({ page }) => {
    await page.goto('/ajustes');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /backup/i }).click();
    await expect(page.getByRole('button', { name: /descargar backup/i })).toBeVisible();
  });

  test('BackupManager: reinicio requiere texto REINICIAR para habilitar confirmación (Req 15.5)', async ({ page }) => {
    await page.goto('/ajustes');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /backup/i }).click();
    await page.getByRole('button', { name: /reiniciar sistema/i }).click();

    const confirmBtn = page.getByRole('dialog').getByRole('button', { name: /confirmar reinicio/i });
    await expect(confirmBtn).toBeDisabled();

    await page.getByRole('dialog').getByPlaceholder(/REINICIAR/i).fill('REINICIAR');
    await expect(confirmBtn).toBeEnabled();
  });

  test('BackupManager: reinicio preserva branding y elimina estudiantes (Req 15.4)', async ({ page }) => {
    await seedAll(page, {
      students: [{ id: 'stu-1', firstName: 'Test' }],
      branding: { wordmark: 'Meraki E2E', tagline: null, logo: null },
    });

    await page.goto('/ajustes');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /backup/i }).click();
    await page.getByRole('button', { name: /reiniciar sistema/i }).click();
    await page.getByRole('dialog').getByPlaceholder(/REINICIAR/i).fill('REINICIAR');
    await page.getByRole('dialog').getByRole('button', { name: /confirmar reinicio/i }).click();

    await expect(page.getByText(/datos reiniciados/i)).toBeVisible();

    const branding = await lsGet<{ wordmark: string }>(page, 'branding');
    expect(branding?.wordmark).toBe('Meraki E2E');

    const students = await lsGet(page, 'students');
    expect(students).toBeNull();
  });

  // ── Tab Comunicación ───────────────────────────────────────────────────────

  test('tab Comunicación muestra canales para activar/desactivar (Req 15.1)', async ({ page }) => {
    await seedAll(page, {
      communication_config: {
        channels: [
          { channelId: 'email', enabled: true, notificationTypes: [] },
          { channelId: 'telegram', enabled: false, notificationTypes: [] },
          { channelId: 'whatsapp', enabled: true, notificationTypes: [] },
        ],
        templates: {},
      },
    });

    await page.goto('/ajustes');
    await page.waitForLoadState('load');

    await page.getByRole('tab', { name: /comunicación/i }).click();

    await expect(page.getByText('Email')).toBeVisible();
    await expect(page.getByText('Telegram')).toBeVisible();
    await expect(page.getByText('WhatsApp')).toBeVisible();
  });
});
