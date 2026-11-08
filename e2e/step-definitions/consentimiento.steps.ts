/**
 * step-definitions/consentimiento.steps.ts
 * Steps para: features/consentimiento/gestion-consentimientos.feature
 */

import { expect, type Page } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { ConsentPage } from '../pages/ConsentPage';
import { TEST_STUDENT, TEST_MINOR_STUDENT, conNombre } from '../fixtures/students';
import { DEFAULT_CONSENT_CONFIG, signedConsentFor, unsignedConsent } from '../fixtures/consent';
import { lsGet, seedAll } from '../helpers/seed';

let consentPage: ConsentPage;

// ── Antecedentes / Given ──────────────────────────────────────────────────────

Given('que existe una configuración de consentimiento en versión 1', async ({ page }) => {
  // El antecedente solo inicializa la configuración base.
  // Los Given de escenario individuales añaden estudiantes según el caso.
  await seedAll(page, { consent_config: DEFAULT_CONSENT_CONFIG });
  consentPage = new ConsentPage(page);
});

Given('que hay un estudiante registrado en el sistema', async ({ page }) => {
  await seedAll(page, {
    consent_config: DEFAULT_CONSENT_CONFIG,
    students: [TEST_STUDENT],
  });
  consentPage = new ConsentPage(page);
});

Given('que el estudiante {string} no ha firmado el consentimiento', async ({ page }, nombre: string) => {
  await seedAll(page, {
    consent_config: DEFAULT_CONSENT_CONFIG,
    students: [{ ...conNombre(TEST_STUDENT, nombre), consent: unsignedConsent }],
  });
  consentPage = new ConsentPage(page);
});

Given(
  'que el estudiante {string} ha firmado el consentimiento en la versión vigente',
  async ({ page }, nombre: string) => {
    await seedAll(page, {
      consent_config: DEFAULT_CONSENT_CONFIG,
      students: [{ ...conNombre(TEST_STUDENT, nombre), consent: signedConsentFor(1) }],
    });
    consentPage = new ConsentPage(page);
  },
);

Given('que el estudiante {string} es menor de edad y no ha firmado', async ({ page }, nombre: string) => {
  await seedAll(page, {
    consent_config: DEFAULT_CONSENT_CONFIG,
    students: [{ ...conNombre(TEST_MINOR_STUDENT, nombre), consent: unsignedConsent }],
  });
  consentPage = new ConsentPage(page);
});

Given(
  'que el estudiante {string} firmó en una versión anterior del consentimiento',
  async ({ page }, nombre: string) => {
    // Config en v2 pero el estudiante firmó en v1 → muestra PDF del firmado anterior
    await seedAll(page, {
      consent_config: { version: 2, updatedDate: new Date().toISOString(), text: 'T', minorText: 'TM' },
      students: [{
        ...conNombre(TEST_STUDENT, nombre),
        consent: signedConsentFor(1), // firmó v1, config es v2
      }],
    });
    consentPage = new ConsentPage(page);
  },
);

// ── When ──────────────────────────────────────────────────────────────────────

When('accede al módulo de consentimiento', async ({ page }) => {
  consentPage = new ConsentPage(page);
  await consentPage.goto();
});

When('el administrador accede al módulo de consentimiento', async ({ page }) => {
  consentPage = new ConsentPage(page);
  await consentPage.goto();
});

When('empieza a editar el texto del consentimiento', async ({}) => {
  await consentPage.abrirEdicion();
});

When('guarda una nueva versión del texto de consentimiento', async ({}) => {
  await consentPage.actualizarTextoConsentimiento('Texto actualizado v2 E2E');
});

When('inicia la firma de {string}', async ({}, nombre: string) => {
  await consentPage.abrirDialogoFirma(nombre);
});

// ── Then ──────────────────────────────────────────────────────────────────────

Then('debería ver el número de versión activa', async ({}) => {
  await expect(consentPage.versionEnPagina(1)).toBeVisible();
});

Then('debería ver el texto del consentimiento para adultos', async ({}) => {
  await expect(consentPage.textoConsentimiento(DEFAULT_CONSENT_CONFIG.text)).toBeVisible();
});

Then('debería ver el texto del consentimiento para menores', async ({}) => {
  await consentPage.tabMenores.click();
  await expect(consentPage.textoConsentimiento(DEFAULT_CONSENT_CONFIG.minorText)).toBeVisible();
});

Then('debería ver a {string} en la lista de pendientes', async ({}, nombre: string) => {
  await expect(consentPage.nombreEstudiante(nombre)).toBeVisible();
});

Then('debería poder iniciar la firma de ese estudiante', async ({}) => {
  await expect(consentPage.btnFirmar()).toBeVisible();
});

Then('debería ver el mensaje de que todos los estudiantes han firmado', async ({}) => {
  await expect(consentPage.mensajeTodosFirmaron).toBeVisible();
});

Then('{string} debería aparecer nuevamente en la lista de pendientes', async ({}, nombre: string) => {
  await expect(consentPage.nombreEstudiante(nombre)).toBeVisible();
});

Then('debería poder diferir la firma de ese estudiante', async ({}) => {
  await expect(consentPage.btnDiferir()).toBeVisible();
  await expect(consentPage.btnFirmar()).toBeVisible();
});

Then('debería ver el campo de texto para editar el consentimiento', async ({}) => {
  await expect(consentPage.textareaEdicion).toBeVisible();
});

Then('debería poder dibujar la firma', async ({}) => {
  await expect(consentPage.dialog).toBeVisible();
  await expect(consentPage.canvasFirma).toBeVisible();
});

Then('debería poder descargar el PDF firmado', async ({}) => {
  await expect(consentPage.btnDescargarPDF()).toBeVisible();
});

// ── Firma real y ataques ──────────────────────────────────────────────────────

type ConsentGuardado = {
  firstName: string;
  lastName: string;
  consent: { signed: boolean; signedVersion: number; signature: string };
};

const consentGuardado = async (page: Page, nombre: string) => {
  await page.waitForTimeout(300);
  const estudiantes = (await lsGet<ConsentGuardado[]>(page, 'students')) ?? [];
  return estudiantes.find((s) => `${s.firstName} ${s.lastName}` === nombre)?.consent;
};

When('firma el consentimiento de {string}', async ({ page }, nombre: string) => {
  await consentPage.abrirDialogoFirma(nombre);
  const caja = await consentPage.canvasFirma.boundingBox();
  if (!caja) throw new Error('Canvas de firma no visible');
  await page.mouse.move(caja.x + 30, caja.y + 30);
  await page.mouse.down();
  await page.mouse.move(caja.x + 160, caja.y + 70, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('dialog').getByRole('button', { name: /confirmar firma/i }).click();
});

When('intenta guardar una versión con el texto vacío', async ({}) => {
  await consentPage.abrirEdicion();
  await consentPage.textareaEdicion.first().fill('');
  await consentPage.btnGuardarVersion.click({ timeout: 1500 }).catch(() => undefined);
});

Then('el consentimiento de {string} debería quedar firmado en la versión vigente', async ({ page }, nombre: string) => {
  const consent = await consentGuardado(page, nombre);
  expect(consent?.signed).toBe(true);
  expect(consent?.signature).toMatch(/^data:image/);
});

Then('no debería poder confirmar la firma', async ({ page }) => {
  await expect(page.getByRole('dialog').getByRole('button', { name: /confirmar firma/i })).toBeDisabled();
});

Then('el consentimiento de {string} no debería quedar firmado', async ({ page }, nombre: string) => {
  expect((await consentGuardado(page, nombre))?.signed).toBe(false);
});

Then('{string} debería seguir sin pendientes de firma', async ({ page }, nombre: string) => {
  const consent = await consentGuardado(page, nombre);
  const config = await lsGet<{ version: number }>(page, 'consent_config');
  expect(consent?.signedVersion).toBe(config?.version);
});
