/**
 * pages/CourtesiesPage.ts
 * Page Object para el módulo de Cortesías (/cortesias).
 */

import type { Page } from '@playwright/test';

export class CourtesiesPage {
  constructor(private readonly page: Page) {}

  // ── Navegación ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/cortesias');
    await this.page.waitForLoadState('load');
  }

  // ── Locators ───────────────────────────────────────────────────────────────

  get heading() {
    return this.page.getByRole('heading', { name: /cortesías/i });
  }

  get btnNuevoBono() {
    return this.page.getByRole('button', { name: /nuevo bono/i });
  }

  get mensajeSinBonos() {
    return this.page.getByText(/no hay bonos/i);
  }

  get dialog() {
    return this.page.getByRole('dialog');
  }

  get dialogSelectEstudiante() {
    return this.dialog.getByRole('combobox');
  }

  get dialogBtnRegistrar() {
    return this.dialog.getByRole('button', { name: /registrar/i });
  }

  // ── Acciones ───────────────────────────────────────────────────────────────

  async abrirDialogoNuevoBono() {
    await this.btnNuevoBono.click();
  }

  async seleccionarEstudiante(nombre: string) {
    await this.dialogSelectEstudiante.click();
    await this.page.getByRole('option', { name: new RegExp(nombre, 'i') }).click();
  }

  async llenarFormularioBono(datos: {
    fechaInicio: string;
    duracionSemanas: number;
    razon: string;
  }) {
    await this.page.getByLabel(/fecha de inicio/i).fill(datos.fechaInicio);
    await this.page.getByLabel(/duración/i).fill(String(datos.duracionSemanas));
    await this.page.getByLabel(/razón/i).fill(datos.razon);
  }

  async registrarBono() {
    await this.dialogBtnRegistrar.click();
  }

  async eliminarBono(titulo?: string) {
    if (titulo) {
      // Busca el botón de eliminar dentro del grupo que contiene el título
      const grupo = this.page.locator('div').filter({ hasText: titulo }).first();
      await grupo.getByTitle(/eliminar bono/i).click();
    } else {
      await this.page.getByTitle(/eliminar bono/i).first().click();
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  badgeEstado(estado: string) {
    return this.page.getByText(estado, { exact: true });
  }

  textoBono(razon: string) {
    return this.page.getByText(razon);
  }

  nombreEstudianteEnGrupo(razon: string, nombre: string) {
    return this.page.locator('div').filter({ hasText: razon }).first().getByText(nombre);
  }
}
