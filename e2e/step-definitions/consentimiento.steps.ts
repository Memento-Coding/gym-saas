/**
 * step-definitions/consentimiento.steps.ts
 * Steps para: features/consentimiento/gestion-consentimientos.feature
 */

import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { ConsentPage } from '../pages/ConsentPage';
import { TEST_STUDENT, TEST_MINOR_STUDENT } from '../fixtures/students';
import { DEFAULT_CONSENT_CONFIG, signedConsentFor, unsignedConsent } from '../fixtures/consent';
import { seedAll } from '../helpers/seed';

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

Given('que el estudiante {string} no ha firmado el consentimiento', async ({ page }, _nombre: string) => {
  await seedAll(page, {
    consent_config: DEFAULT_CONSENT_CONFIG,
    students: [{ ...TEST_STUDENT, consent: unsignedConsent }],
  });
  consentPage = new ConsentPage(page);
});

Given(
  'que el estudiante {string} ha firmado el consentimiento en la versión vigente',
  async ({ page }, _nombre: string) => {
    await seedAll(page, {
      consent_config: DEFAULT_CONSENT_CONFIG,
      students: [{ ...TEST_STUDENT, consent: signedConsentFor(1) }],
    });
    consentPage = new ConsentPage(page);
  },
);

Given('que el estudiante {string} es menor de edad y no ha firmado', async ({ page }, _nombre: string) => {
  await seedAll(page, {
    consent_config: DEFAULT_CONSENT_CONFIG,
    students: [{ ...TEST_MINOR_STUDENT, consent: unsignedConsent }],
  });
  consentPage = new ConsentPage(page);
});

Given(
  'que el estudiante {string} firmó en una versión anterior del consentimiento',
  async ({ page }, _nombre: string) => {
    // Config en v2 pero el estudiante firmó en v1 → muestra PDF del firmado anterior
    await seedAll(page, {
      consent_config: { version: 2, updatedDate: new Date().toISOString(), text: 'T', minorText: 'TM' },
      students: [{
        ...TEST_STUDENT,
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

When('hace clic en el botón de editar', async ({}) => {
  await consentPage.abrirEdicion();
});

When('guarda una nueva versión del texto de consentimiento', async ({}) => {
  await consentPage.actualizarTextoConsentimiento('Texto actualizado v2 E2E');
});

When('abre el diálogo de firma para {string}', async ({}, _nombre: string) => {
  await consentPage.abrirDialogoFirma();
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

Then('debería ver el botón de firma disponible para ese estudiante', async ({}) => {
  await expect(consentPage.btnFirmar()).toBeVisible();
});

Then('debería ver el mensaje de que todos los estudiantes han firmado', async ({}) => {
  await expect(consentPage.mensajeTodosFirmaron).toBeVisible();
});

Then('{string} debería aparecer nuevamente en la lista de pendientes', async ({}, nombre: string) => {
  await expect(consentPage.nombreEstudiante(nombre)).toBeVisible();
});

Then('debería ver el botón de diferir junto al botón de firma para ese estudiante', async ({}) => {
  await expect(consentPage.btnDiferir()).toBeVisible();
  await expect(consentPage.btnFirmar()).toBeVisible();
});

Then('debería ver el campo de texto para editar el consentimiento', async ({}) => {
  await expect(consentPage.textareaEdicion).toBeVisible();
});

Then('debería ver el canvas para capturar la firma', async ({}) => {
  await expect(consentPage.dialog).toBeVisible();
  await expect(consentPage.canvasFirma).toBeVisible();
});

Then('debería ver el botón de descarga del PDF firmado', async ({}) => {
  await expect(consentPage.btnDescargarPDF()).toBeVisible();
});
