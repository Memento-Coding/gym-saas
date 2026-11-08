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
import { diasDesdeHoy } from '../helpers/dates';

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

When('entra a la sección de formulario', async ({}) => {
  await settingsPage.irAFormulario();
});

When('entra a la sección de backup', async ({}) => {
  await settingsPage.irABackup();
});

When('entra a la sección de comunicación en ajustes', async ({}) => {
  await settingsPage.irAComunicacion();
});

When('solicita el reinicio del sistema', async ({}) => {
  await settingsPage.btnReiniciarSistema.click();
});

When('ejecuta el reinicio completo del sistema', async ({}) => {
  await settingsPage.ejecutarReinicioSistema();
});

When('elimina el campo {string}', async ({}, nombre: string) => {
  await settingsPage.eliminarCampo(nombre);
});

// ── Then ──────────────────────────────────────────────────────────────────────

Then('debería ver la sección de marca', async ({}) => {
  await expect(settingsPage.tabMarca).toBeVisible();
});

Then('debería ver la sección de planes', async ({}) => {
  await expect(settingsPage.tabPlanes).toBeVisible();
});

Then('debería ver la sección de formulario', async ({}) => {
  await expect(settingsPage.tabFormulario).toBeVisible();
});

Then('debería ver la sección de backup', async ({}) => {
  await expect(settingsPage.tabBackup).toBeVisible();
});

Then('debería ver la sección de comunicación', async ({}) => {
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

Then('debería poder descargar el backup', async ({}) => {
  await expect(settingsPage.btnDescargarBackup).toBeVisible();
});

Then('no debería poder confirmar el reinicio', async ({}) => {
  await expect(settingsPage.btnConfirmarReinicio).toBeDisabled();
});

Then('al escribir {string} debería poder confirmar el reinicio', async ({}, texto: string) => {
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

When('escribe {string} como confirmación de reinicio', async ({}, texto: string) => {
  await settingsPage.inputConfirmacionReinicio.fill(texto);
});

const BACKUPS_DANADOS: Record<string, string> = {
  'que no es JSON': '{no es json',
  'con una lista': '[]',
  vacío: 'null',
  'con datos inválidos': '{"students":"x"}',
};

When('entra a la sección de planes', async ({}) => {
  await settingsPage.tabPlanes.click();
});

When('importa un backup {string}', async ({ page }, tipo: string) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(BACKUPS_DANADOS[tipo]),
  });
  await page.waitForTimeout(500);
});

Then('los datos del sistema deberían seguir intactos', async ({ page }) => {
  const estudiantes = await lsGet<unknown[]>(page, 'students');
  expect(estudiantes).toHaveLength(1);
  const marca = await lsGet<{ wordmark: string }>(page, 'branding');
  expect(marca?.wordmark).toBe('Meraki E2E');
});

let planesAntes = 0;

When('intenta agregar el plan {string} con precio {string}', async ({ page }, nombre: string, precio: string) => {
  planesAntes = await page.locator('[aria-label^="Precio del plan "]').count();
  await page.getByRole('button', { name: 'Agregar plan grupal' }).click();
  await page.getByLabel('Nombre del nuevo plan').fill(nombre);
  await page.getByLabel('Precio del nuevo plan').fill(precio);
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
});

Then('no debería agregarse ningún plan', async ({ page }) => {
  await expect(page.getByRole('alert').first()).toBeVisible();
  expect(await page.locator('[aria-label^="Precio del plan "]').count()).toBe(planesAntes);
});

// ── Planes y logo ────────────────────────────────────────────────────────────

Given('que el plan {string} tiene un estudiante vigente', async ({ page }, plan: string) => {
  await seedAll(page, {
    costs: {
      memberships: [
        { id: 'plan-usado', name: plan, price: 90000 },
        { id: 'plan-libre', name: 'Sin alumnos', price: 50000 },
      ],
      personalized: [],
    },
    students: [{ ...TEST_STUDENT, planId: 'plan-usado', planName: plan, status: 'active', subscriptionEndDate: diasDesdeHoy(30) }],
  });
  settingsPage = new SettingsPage(page);
});

When('abre la sección de planes', async () => {
  await settingsPage.tabPlanes.click();
});

When('intenta subir un logo de {int} KB', async ({ page }, kb: number) => {
  await settingsPage.irAMarca();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(kb * 1024),
  });
});

Then('el plan {string} no debería poder eliminarse', async ({ page }, plan: string) => {
  await expect(page.getByRole('button', { name: `Eliminar plan ${plan}` })).toBeDisabled();
});

Then('el plan {string} debería poder eliminarse', async ({ page }, plan: string) => {
  await expect(page.getByRole('button', { name: `Eliminar plan ${plan}` })).toBeEnabled();
});

Then('debería avisar que el logo es demasiado pesado', async ({ page }) => {
  await expect(page.getByText(/no puede superar 200 KB/i)).toBeVisible();
});

Then('no debería mostrarse ningún logo', async ({ page }) => {
  await expect(page.getByRole('img', { name: /logo de la academia/i })).toHaveCount(0);
});
