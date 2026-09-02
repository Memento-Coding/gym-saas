/**
 * step-definitions/comunicacion.steps.ts
 * Steps para: features/comunicacion/gestion-comunicacion.feature
 */

import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { CommunicationPage } from '../pages/CommunicationPage';
import { TEST_STUDENT } from '../fixtures/students';
import { seedAll } from '../helpers/seed';

let communicationPage: CommunicationPage;

// ── Given ─────────────────────────────────────────────────────────────────────

Given('que existe un estudiante registrado', async ({ page }) => {
  await seedAll(page, { students: [TEST_STUDENT] });
  communicationPage = new CommunicationPage(page);
});

// ── When ──────────────────────────────────────────────────────────────────────

When('accede al módulo de comunicación', async ({ page }) => {
  communicationPage = new CommunicationPage(page);
  await communicationPage.goto();
});

When('navega a la pestaña de canales', async ({}) => {
  await communicationPage.irACanales();
});

When('navega a la pestaña de envío', async ({}) => {
  await communicationPage.irAEnviar();
});

When('edita la primera plantilla con el texto {string}', async ({}, texto: string) => {
  await communicationPage.editarPrimeraPlantilla(texto);
});

When('selecciona todos los estudiantes', async ({}) => {
  await communicationPage.btnSeleccionarTodos.click();
});

When('selecciona la plantilla {string}', async ({}, nombre: string) => {
  await communicationPage.seleccionarPlantilla(nombre);
});

// ── Then ──────────────────────────────────────────────────────────────────────

Then('debería ver la pestaña de plantillas', async ({}) => {
  await expect(communicationPage.tabPlantillas).toBeVisible();
});

Then('debería ver la pestaña de canales', async ({}) => {
  await expect(communicationPage.tabCanales).toBeVisible();
});

Then('debería ver la pestaña de envío', async ({}) => {
  await expect(communicationPage.tabEnviar).toBeVisible();
});

Then('debería ver la plantilla {string}', async ({}, nombre: string) => {
  await expect(communicationPage.textoPlantilla(nombre)).toBeVisible();
});

Then('la primera plantilla debería contener la variable dinámica del nombre', async ({}) => {
  const valor = await communicationPage.primerTextareaPlantilla.inputValue();
  expect(valor).toContain('{{nombre}}');
});

Then('debería ver el nuevo texto guardado en la plantilla', async ({}) => {
  await expect(communicationPage.primerTextareaPlantilla).not.toBeEmpty();
});

Then('debería ver el canal {string}', async ({}, nombre: string) => {
  await expect(communicationPage.nombreCanal(nombre)).toBeVisible();
});

Then('debería ver los controles para activar o desactivar cada canal', async ({}) => {
  const toggles = communicationPage.togglesCanales;
  expect(await toggles.count()).toBeGreaterThanOrEqual(1);
});

Then('el botón de enviar debería estar deshabilitado', async ({}) => {
  await expect(communicationPage.btnEnviar).toBeDisabled();
});

Then('el botón debería cambiar a deseleccionar todos', async ({}) => {
  await expect(communicationPage.btnDeseleccionarTodos).toBeVisible();
});

Then('debería ver la opción de previsualizar el mensaje para el estudiante', async ({}) => {
  await expect(communicationPage.btnPrevisualizarPrimero).toBeVisible();
});

Then('al previsualizar debería ver el nombre del estudiante resuelto en el mensaje', async ({}) => {
  await communicationPage.abrirVistaPreviaParaPrimeroEstudiante();
  await expect(communicationPage.destinatarioEnPreview('Ana García')).toBeVisible();
});
