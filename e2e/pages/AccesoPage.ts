/**
 * pages/AccesoPage.ts
 * Page Object de las pantallas públicas: /login, /registro y /recuperar-password.
 */

import type { Page } from '@playwright/test';

export class AccesoPage {
  constructor(public readonly page: Page) {}

  async abrir(ruta: string) {
    await this.page.goto(ruta);
    await this.page.waitForLoadState('load');
  }

  get correo() {
    return this.page.locator('input[type="email"]');
  }

  get error() {
    return this.page.locator('.text-destructive, [class*="destructive"]').filter({ hasText: /\S/ }).first();
  }

  /** Da tiempo a que cualquier solicitud salga antes de afirmar que no ocurrió. */
  async asentar() {
    await this.page.waitForTimeout(500);
  }

  async llenarLogin(correo: string, clave: string) {
    await this.correo.fill(correo);
    await this.page.locator('input[type="password"]').fill(clave);
  }

  get btnEntrar() {
    return this.page.locator('button[type="submit"]');
  }

  async registrar(correo: string, clave: string, confirmacion: string) {
    await this.correo.fill(correo);
    await this.page.locator('#password').fill(clave);
    await this.page.locator('#confirm-password').fill(confirmacion);
    await this.page.getByRole('button', { name: /crear cuenta/i }).click();
  }

  async confirmarCodigo(codigo: string) {
    await this.page.locator('#code').fill(codigo);
    await this.page.getByRole('button', { name: /^verificar$/i }).click();
  }

  get campoCodigo() {
    return this.page.locator('#code');
  }

  async pedirRecuperacion(correo: string) {
    await this.correo.fill(correo);
    await this.page.getByRole('button', { name: /enviar código/i }).click();
    await this.campoCodigo.waitFor({ state: 'visible' });
  }

  async definirClave(codigo: string, clave: string) {
    await this.campoCodigo.fill(codigo);
    await this.page.locator('#new-password').fill(clave);
    await this.page.locator('#confirm-new-password').fill(clave);
    await this.page.getByRole('button', { name: /restablecer/i }).click();
  }
}
