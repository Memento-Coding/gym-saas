/**
 * step-definitions/autenticacion.steps.ts
 * Steps para: features/autenticacion/* y features/legal/*
 * Corren en el proyecto "bdd-sin-sesion", con el login real activo y Cognito simulado.
 */

import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { AccesoPage } from '../pages/AccesoPage';
import { sembrarSesion, simularCognito, type RespuestaCognito } from '../helpers/cognito';

const CLIENT_ID = 'e2efakeclient';
const ENTREGA = { CodeDeliveryDetails: { Destination: 'a***@g***', DeliveryMedium: 'EMAIL', AttributeName: 'email' } };
const REGISTRO_OK: RespuestaCognito = { ok: { UserConfirmed: false, UserSub: 'e2e-sub', ...ENTREGA } };
const CODIGO_MALO: RespuestaCognito = { error: 'CodeMismatchException', mensaje: 'Invalid verification code provided.' };

let acceso: AccesoPage;
let llamadas: string[] = [];

Given('que el servidor rechaza las credenciales', async ({ page }) => {
  llamadas = await simularCognito(page, {
    InitiateAuth: { error: 'NotAuthorizedException', mensaje: 'Incorrect username or password.' },
  });
});

Given('que el servidor acepta el registro', async ({ page }) => {
  llamadas = await simularCognito(page, { SignUp: REGISTRO_OK, ConfirmSignUp: { ok: {} } });
});

Given('que el servidor acepta el registro pero rechaza el código', async ({ page }) => {
  llamadas = await simularCognito(page, { SignUp: REGISTRO_OK, ConfirmSignUp: CODIGO_MALO });
});

Given('que el servidor rechaza correos no autorizados', async ({ page }) => {
  llamadas = await simularCognito(page, {
    SignUp: {
      error: 'UserLambdaValidationException',
      mensaje: 'PreSignUp failed with error Este correo no está autorizado para usar GymOps. Contacta al administrador..',
    },
  });
});

Given('que el servidor acepta la recuperación', async ({ page }) => {
  llamadas = await simularCognito(page, { ForgotPassword: { ok: ENTREGA }, ConfirmForgotPassword: { ok: {} } });
});

Given('que el servidor acepta la recuperación pero rechaza el código', async ({ page }) => {
  llamadas = await simularCognito(page, { ForgotPassword: { ok: ENTREGA }, ConfirmForgotPassword: CODIGO_MALO });
});

Given('que el usuario tiene una sesión activa', async ({ page }) => {
  await sembrarSesion(page, CLIENT_ID);
});

// ── Navegación ───────────────────────────────────────────────────────────────

When('abre la pantalla de inicio de sesión', async ({ page }) => {
  acceso = new AccesoPage(page);
  await acceso.abrir('/login');
});

When('abre la pantalla de registro', async ({ page }) => {
  acceso = new AccesoPage(page);
  await acceso.abrir('/registro');
});

When('abre la pantalla de recuperación', async ({ page }) => {
  acceso = new AccesoPage(page);
  await acceso.abrir('/recuperar-password');
});

When('intenta abrir {string} sin haber iniciado sesión', async ({ page }, ruta: string) => {
  acceso = new AccesoPage(page);
  await acceso.abrir(ruta);
});

When('intenta abrir {string} con su sesión', async ({ page }, ruta: string) => {
  acceso = new AccesoPage(page);
  await acceso.abrir(ruta);
});

When('abre la página pública {string}', async ({ page }, ruta: string) => {
  acceso = new AccesoPage(page);
  await acceso.abrir(ruta);
});

// ── Acciones ─────────────────────────────────────────────────────────────────

When('inicia sesión con {string} y {string}', async ({ page }, correo: string, clave: string) => {
  acceso = new AccesoPage(page);
  await acceso.abrir('/login');
  await acceso.llenarLogin(correo, clave);
  await acceso.btnEntrar.first().click();
});

When('inicia sesión con doble clic usando {string} y {string}', async ({ page }, correo: string, clave: string) => {
  acceso = new AccesoPage(page);
  await acceso.abrir('/login');
  await acceso.llenarLogin(correo, clave);
  await acceso.btnEntrar.first().dblclick();
});

When('se registra con {string} y la clave {string}', async ({ page }, correo: string, clave: string) => {
  acceso = new AccesoPage(page);
  await acceso.abrir('/registro');
  await acceso.registrar(correo, clave, clave);
});

When(
  'se registra con {string}, la clave {string} y la confirmación {string}',
  async ({ page }, correo: string, clave: string, confirmacion: string) => {
    acceso = new AccesoPage(page);
    await acceso.abrir('/registro');
    await acceso.registrar(correo, clave, confirmacion);
  },
);

When('confirma el código {string}', async ({}, codigo: string) => {
  await acceso.campoCodigo.waitFor({ state: 'visible' });
  await acceso.confirmarCodigo(codigo);
});

When('solicita recuperar la clave de {string}', async ({ page }, correo: string) => {
  acceso = new AccesoPage(page);
  await acceso.abrir('/recuperar-password');
  await acceso.pedirRecuperacion(correo);
});

When('define la clave {string} con el código {string}', async ({}, clave: string, codigo: string) => {
  await acceso.definirClave(codigo, clave);
});

// ── Resultados ───────────────────────────────────────────────────────────────

Then('debería ver el formulario de inicio de sesión', async () => {
  await expect(acceso.correo).toBeVisible();
  await expect(acceso.page.locator('input[type="password"]')).toBeVisible();
});

Then('debería ver los enlaces a privacidad y condiciones', async ({ page }) => {
  await expect(page.getByRole('link', { name: /privacidad/i })).toHaveAttribute('href', '/privacidad');
  await expect(page.getByRole('link', { name: /condiciones/i })).toHaveAttribute('href', '/terminos');
});

Then('debería ver el formulario de registro', async () => {
  await expect(acceso.page.locator('#confirm-password')).toBeVisible();
});

Then('debería ver el formulario de recuperación', async () => {
  await expect(acceso.correo).toBeVisible();
});

Then('debería terminar en la pantalla de inicio de sesión', async ({ page }) => {
  await expect(page).toHaveURL(/\/login$/);
});

Then('debería seguir en la pantalla de inicio de sesión', async ({ page }) => {
  await acceso.asentar();
  await expect(page).toHaveURL(/\/login$/);
});

Then('no debería terminar en la pantalla de inicio de sesión', async ({ page }) => {
  await acceso.asentar();
  await expect(page).not.toHaveURL(/\/login$/);
});

Then('debería ver la página de estudiantes', async ({ page }) => {
  await expect(page).toHaveURL(/\/estudiantes$/);
  await expect(page.getByRole('heading', { name: /estudiantes/i })).toBeVisible();
});

Then('debería ver un error de inicio de sesión', async () => {
  await expect(acceso.error).toBeVisible();
});

Then('debería ver un error de verificación', async () => {
  await expect(acceso.error).toBeVisible();
});

Then('debería ver el error {string}', async ({}, texto: string) => {
  await expect(acceso.error).toContainText(texto);
});

Then('no debería haberse consultado el servidor', async () => {
  await acceso.asentar();
  expect(llamadas).toEqual([]);
});

Then('debería haberse consultado el servidor {int} vez', async ({}, veces: number) => {
  await acceso.asentar();
  expect(llamadas).toHaveLength(veces);
});

Then('no debería pedir el código de verificación', async () => {
  await acceso.asentar();
  await expect(acceso.campoCodigo).toBeHidden();
});

Then('debería seguir pidiendo el código de verificación', async () => {
  await acceso.asentar();
  await expect(acceso.campoCodigo).toBeVisible();
});

Then('no debería haberse cambiado la clave en el servidor', async () => {
  await acceso.asentar();
  expect(llamadas).not.toContain('ConfirmForgotPassword');
});

// ── Páginas legales ──────────────────────────────────────────────────────────

Then('debería ver el título {string}', async ({ page }, titulo: string) => {
  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
});

Then('debería ver al responsable {string}', async ({ page }, nombre: string) => {
  await expect(page.getByText(nombre).first()).toBeVisible();
});

Then('debería ver un correo de contacto', async ({ page }) => {
  await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
});

Then('debería ver los derechos del titular de los datos', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /derechos del titular/i })).toBeVisible();
});

Then('no debería ver el menú de la aplicación', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Estudiantes' })).toHaveCount(0);
});

Then('debería ver contenido en la pantalla', async ({ page }) => {
  await expect(page.locator('body')).not.toHaveText(/^\s*$/);
});
