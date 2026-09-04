/**
 * pages/ConsentPage.ts
 * Page Object para el módulo de Consentimiento (/consentimiento).
 */

import type { Page } from '@playwright/test';

export class ConsentPage {
  constructor(private readonly page: Page) {}

  // ── Navegación ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/consentimiento');
    await this.page.waitForLoadState('load');
  }

  // ── Locators — encabezado y stats ──────────────────────────────────────────

  get heading() {
    return this.page.getByRole('heading', { name: /consentimiento/i });
  }

  get statVersionActual() {
    return this.page.getByText('Versión actual', { exact: true });
  }

  get statPendientes() {
    return this.page.getByText('Pendientes', { exact: true });
  }

  get mensajeTodosFirmaron() {
    return this.page.getByText(/todos los estudiantes han firmado/i);
  }

  // ── Locators — visor de texto ──────────────────────────────────────────────

  get tabAdultos() {
    return this.page.getByRole('tab', { name: /adultos/i });
  }

  get tabMenores() {
    return this.page.getByRole('tab', { name: /menores/i });
  }

  get btnEditar() {
    return this.page.getByRole('button', { name: /editar/i });
  }

  get textareaEdicion() {
    return this.page.getByRole('textbox').first();
  }

  get btnGuardarVersion() {
    return this.page.getByRole('button', { name: /guardar nueva versión|actualizar/i });
  }

  // ── Locators — lista de pendientes ─────────────────────────────────────────

  btnFirmar(nombre?: string) {
    if (nombre) {
      return this.page
        .locator('li, tr, div')
        .filter({ hasText: nombre })
        .getByRole('button', { name: /firmar/i });
    }
    return this.page.getByRole('button', { name: /firmar/i }).first();
  }

  btnDiferir(nombre?: string) {
    if (nombre) {
      return this.page
        .locator('li, tr, div')
        .filter({ hasText: nombre })
        .getByRole('button', { name: /diferir/i });
    }
    return this.page.getByRole('button', { name: /diferir/i }).first();
  }

  btnDescargarPDF() {
    return this.page.getByTitle(/descargar PDF/i);
  }

  nombreEstudiante(nombre: string) {
    return this.page.getByText(nombre);
  }

  // ── Locators — diálogo de firma ────────────────────────────────────────────

  get dialog() {
    return this.page.getByRole('dialog');
  }

  get canvasFirma() {
    return this.page.locator('canvas');
  }

  versionEnPagina(v: number) {
    return this.page.getByRole('paragraph').filter({ hasText: `v${v}` });
  }

  textoConsentimiento(texto: string) {
    return this.page.getByText(texto);
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  async abrirEdicion() {
    await this.btnEditar.click();
  }

  async actualizarTextoConsentimiento(nuevoTexto: string) {
    await this.abrirEdicion();
    await this.textareaEdicion.fill(nuevoTexto);
    await this.btnGuardarVersion.click();
  }

  async abrirDialogoFirma(nombreEstudiante?: string) {
    await this.btnFirmar(nombreEstudiante).click();
  }
}
