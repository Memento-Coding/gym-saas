/**
 * pages/CommunicationPage.ts
 * Page Object para el módulo de Comunicación (/comunicacion).
 */

import type { Page } from '@playwright/test';

export class CommunicationPage {
  constructor(private readonly page: Page) {}

  // ── Navegación ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/comunicacion');
    await this.page.waitForLoadState('load');
  }

  // ── Locators — tabs ────────────────────────────────────────────────────────

  get tabPlantillas() {
    return this.page.getByRole('tab', { name: /plantillas/i });
  }

  get tabCanales() {
    return this.page.getByRole('tab', { name: /canales/i });
  }

  get tabEnviar() {
    return this.page.getByRole('tab', { name: /enviar/i });
  }

  // ── Acciones — tabs ────────────────────────────────────────────────────────

  async irAPlantillas() {
    await this.tabPlantillas.click();
  }

  async irACanales() {
    await this.tabCanales.click();
  }

  async irAEnviar() {
    await this.tabEnviar.click();
  }

  // ── Locators — plantillas ──────────────────────────────────────────────────

  textoPlantilla(nombre: string) {
    return this.page.getByText(nombre, { exact: true });
  }

  get primerTextareaPlantilla() {
    return this.page.getByRole('textbox').first();
  }

  get btnGuardarPlantilla() {
    return this.page.getByRole('button', { name: /guardar plantilla/i }).first();
  }

  // ── Locators — canales ─────────────────────────────────────────────────────

  nombreCanal(nombre: string) {
    return this.page.getByText(nombre);
  }

  get togglesCanales() {
    return this.page.getByRole('checkbox');
  }

  // ── Locators — tab Enviar ──────────────────────────────────────────────────

  get selectorPlantilla() {
    return this.page.getByRole('combobox', { name: /plantilla/i });
  }

  get btnSeleccionarTodos() {
    return this.page.getByRole('button', { name: /seleccionar todos/i });
  }

  get btnDeseleccionarTodos() {
    return this.page.getByRole('button', { name: /deseleccionar todos/i });
  }

  get btnEnviar() {
    return this.page.getByRole('button', { name: /enviar a/i });
  }

  get btnPrevisualizarPrimero() {
    return this.page.getByRole('button', { name: /previsualizar/i }).first();
  }

  nombreEstudianteEnLista(nombre: string) {
    return this.page.getByText(nombre);
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  async seleccionarPlantilla(nombre: string) {
    await this.selectorPlantilla.click();
    await this.page.getByRole('option', { name: new RegExp(nombre, 'i') }).click();
  }

  async editarPrimeraPlantilla(texto: string) {
    await this.primerTextareaPlantilla.fill(texto);
    await this.btnGuardarPlantilla.click();
  }

  async abrirVistaPreviaParaPrimeroEstudiante() {
    await this.btnPrevisualizarPrimero.click();
  }

  // ── Locators — MessagePreview ──────────────────────────────────────────────

  destinatarioEnPreview(nombre: string) {
    return this.page.getByText('Para:', { exact: true }).locator('..').filter({ hasText: nombre });
  }
}
