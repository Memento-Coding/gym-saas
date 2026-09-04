/**
 * pages/SettingsPage.ts
 * Page Object para el módulo de Ajustes (/ajustes).
 */

import type { Page } from '@playwright/test';

export class SettingsPage {
  constructor(private readonly page: Page) {}

  // ── Navegación ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/ajustes');
    await this.page.waitForLoadState('load');
  }

  // ── Locators — tabs ────────────────────────────────────────────────────────

  get tabMarca()         { return this.page.getByRole('tab', { name: /marca/i }); }
  get tabPlanes()        { return this.page.getByRole('tab', { name: /planes/i }); }
  get tabFormulario()    { return this.page.getByRole('tab', { name: /formulario/i }); }
  get tabBackup()        { return this.page.getByRole('tab', { name: /backup/i }); }
  get tabComunicacion()  { return this.page.getByRole('tab', { name: /comunicación/i }); }

  async irAMarca()        { await this.tabMarca.click(); }
  async irAFormulario()   { await this.tabFormulario.click(); }
  async irABackup()       { await this.tabBackup.click(); }
  async irAComunicacion() { await this.tabComunicacion.click(); }

  // ── Locators — BrandingForm ────────────────────────────────────────────────

  get inputWordmark() {
    return this.page.getByLabel(/wordmark|nombre/i);
  }

  get inputTagline() {
    return this.page.getByLabel(/tagline|eslogan/i);
  }

  get btnGuardarMarca() {
    return this.page.getByRole('button', { name: /guardar marca/i });
  }

  get toastMarcaGuardada() {
    return this.page.getByText(/configuración de marca guardada/i);
  }

  // ── Acciones — BrandingForm ────────────────────────────────────────────────

  async guardarMarca(wordmark: string, tagline: string) {
    await this.irAMarca();
    await this.inputWordmark.fill(wordmark);
    await this.inputTagline.fill(tagline);
    await this.btnGuardarMarca.click();
  }

  // ── Locators — FormFieldConfig ─────────────────────────────────────────────

  get btnAgregarCampo() {
    return this.page.getByRole('button', { name: /agregar campo/i });
  }

  get inputNombreCampo() {
    return this.page.getByPlaceholder(/nombre del campo/i);
  }

  get btnConfirmarAgregarCampo() {
    return this.page.getByRole('button', { name: /^agregar$/i });
  }

  textoCampo(nombre: string) {
    return this.page.getByText(nombre);
  }

  // ── Acciones — FormFieldConfig ─────────────────────────────────────────────

  async agregarCampoPersonalizado(nombre: string) {
    await this.irAFormulario();
    await this.btnAgregarCampo.click();
    await this.inputNombreCampo.fill(nombre);
    await this.btnConfirmarAgregarCampo.click();
  }

  async eliminarCampo(nombre: string) {
    const fila = this.textoCampo(nombre).locator('..').locator('..');
    await fila.getByRole('button').nth(1).click();
    await this.page.getByRole('dialog').getByRole('button', { name: /eliminar/i }).click();
  }

  // ── Locators — BackupManager ───────────────────────────────────────────────

  get btnDescargarBackup() {
    return this.page.getByRole('button', { name: /descargar backup/i });
  }

  get btnReiniciarSistema() {
    return this.page.getByRole('button', { name: /reiniciar sistema/i });
  }

  get inputConfirmacionReinicio() {
    return this.page.getByRole('dialog').getByPlaceholder(/REINICIAR/i);
  }

  get btnConfirmarReinicio() {
    return this.page.getByRole('dialog').getByRole('button', { name: /confirmar reinicio/i });
  }

  get toastDatosReiniciados() {
    return this.page.getByText(/datos reiniciados/i);
  }

  // ── Acciones — BackupManager ───────────────────────────────────────────────

  async ejecutarReinicioSistema() {
    await this.irABackup();
    await this.btnReiniciarSistema.click();
    await this.inputConfirmacionReinicio.fill('REINICIAR');
    await this.btnConfirmarReinicio.click();
  }

  // ── Locators — Tab Comunicación ────────────────────────────────────────────

  nombreCanal(nombre: string) {
    return this.page.getByText(nombre);
  }
}
