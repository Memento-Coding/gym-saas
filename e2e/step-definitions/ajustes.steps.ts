/**
 * step-definitions/ajustes.steps.ts
 * Steps para: features/ajustes/configuracion-sistema.feature
 */

import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { SettingsPage } from '../pages/SettingsPage';
import { TEST_STUDENT } from '../fixtures/students';
import { DEFAULT_COMMUNICATION_CONFIG } from '../fixtures/communication';
import { seedAll, lsGet } from '../helpers/seed';

let settingsPage: SettingsPage;

// ── Given ─────────────────────────────────────────────────────────────────────

Given(
  'que existe el campo personalizado {string} en el formulario',
  async ({ page }, label: string) => {
    await seedAll(page, {
      formFields: [{
        id: 'field-e2e-001',
        name: label.toLowerCase().replace(/\s+/g, '_'),
        label,
        type: 'text',
        required: false,
        isBuiltIn: false,
      }],
    });
    settingsPage = new SettingsPage(page);
  },
);

Given(
  'que existe un estudiante y configuración de marca {string} en el sistema',
  async ({ page }, wordmark: string) => {
    await seedAll(page, {
      students: [{ id: 'stu-reset-e2e', firstName: 'TestReset' }],
      branding: { wordmark, tagline: null, logo: null },
    });
    settingsPage = new SettingsPage(page);
  },
);

Given('que existe configuración de canales de comunicación en el sistema', async ({ page }) => {
  await seedAll(page, { communication_config: DEFAULT_COMMUNICATION_CONFIG });
  settingsPage = new SettingsPage(page);
});

// ── When ──────────────────────────────────────────────────────────────────────

When('accede al módulo de ajustes', async ({ page }) => {
  // Siempre creamos una instancia nueva con la page activa del escenario
  settingsPage = new SettingsPage(page);
  await settingsPage.goto();
});

When('guarda el nombre {string} y el eslogan {string}', async ({}, wordmark: string, tagline: string) => {
  await settingsPage.guardarMarca(wordmark, tagline);
});

When('agrega el campo personalizado {string} al formulario', async ({}, nombre: string) => {
  await settingsPage.agregarCampoPersonalizado(nombre);
});

When('navega a la pestaña de formulario', async ({}) => {
  await settingsPage.irAFormulario();
});

When('navega a la pestaña de backup', async ({}) => {
  await settingsPage.irABackup();
});

When('navega a la pestaña de comunicación en ajustes', async ({}) => {
  await settingsPage.irAComunicacion();
});

When('abre el diálogo de reinicio del sistema', async ({}) => {
  await settingsPage.btnReiniciarSistema.click();
});

When('ejecuta el reinicio completo del sistema', async ({}) => {
  await settingsPage.ejecutarReinicioSistema();
});

When('elimina el campo {string}', async ({}, nombre: string) => {
  await settingsPage.eliminarCampo(nombre);
});

// ── Then ──────────────────────────────────────────────────────────────────────

Then('debería ver la pestaña de marca', async ({}) => {
  await expect(settingsPage.tabMarca).toBeVisible();
});

Then('debería ver la pestaña de planes', async ({}) => {
  await expect(settingsPage.tabPlanes).toBeVisible();
});

Then('debería ver la pestaña de formulario', async ({}) => {
  await expect(settingsPage.tabFormulario).toBeVisible();
});

Then('debería ver la pestaña de backup', async ({}) => {
  await expect(settingsPage.tabBackup).toBeVisible();
});

Then('debería ver la pestaña de comunicación', async ({}) => {
  await expect(settingsPage.tabComunicacion).toBeVisible();
});

Then('debería ver la confirmación de que la marca fue guardada', async ({}) => {
  await expect(settingsPage.toastMarcaGuardada).toBeVisible();
});

Then('el nombre del gimnasio guardado debería ser {string}', async ({ page }, wordmark: string) => {
  const branding = await lsGet<{ wordmark: string }>(page, 'branding');
  expect(branding?.wordmark).toBe(wordmark);
});

Then('el eslogan guardado debería ser {string}', async ({ page }, tagline: string) => {
  const branding = await lsGet<{ tagline: string }>(page, 'branding');
  expect(branding?.tagline).toBe(tagline);
});

Then('debería ver el campo {string} en la lista de campos', async ({}, nombre: string) => {
  await expect(settingsPage.textoCampo(nombre)).toBeVisible();
});

Then('debería ver el campo {string} en la lista', async ({}, nombre: string) => {
  await expect(settingsPage.textoCampo(nombre)).toBeVisible();
});

Then('el campo {string} no debería aparecer en la lista', async ({}, nombre: string) => {
  await expect(settingsPage.textoCampo(nombre)).not.toBeVisible();
});

Then('debería ver el botón para descargar el backup', async ({}) => {
  await expect(settingsPage.btnDescargarBackup).toBeVisible();
});

Then('el botón de confirmar reinicio debería estar deshabilitado', async ({}) => {
  await expect(settingsPage.btnConfirmarReinicio).toBeDisabled();
});

Then('al escribir {string} el botón debería habilitarse', async ({}, texto: string) => {
  await settingsPage.inputConfirmacionReinicio.fill(texto);
  await expect(settingsPage.btnConfirmarReinicio).toBeEnabled();
});

Then('debería ver la confirmación de que los datos fueron reiniciados', async ({}) => {
  await expect(settingsPage.toastDatosReiniciados).toBeVisible();
});

Then('la configuración de marca debería seguir siendo {string}', async ({ page }, wordmark: string) => {
  const branding = await lsGet<{ wordmark: string }>(page, 'branding');
  expect(branding?.wordmark).toBe(wordmark);
});

Then('la lista de estudiantes debería estar vacía', async ({ page }) => {
  const students = await lsGet(page, 'students');
  expect(students).toBeNull();
});

Then('debería ver los canales {string}, {string} y {string}', async ({}, ch1: string, ch2: string, ch3: string) => {
  await expect(settingsPage.nombreCanal(ch1)).toBeVisible();
  await expect(settingsPage.nombreCanal(ch2)).toBeVisible();
  await expect(settingsPage.nombreCanal(ch3)).toBeVisible();
});
