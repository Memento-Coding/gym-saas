/**
 * pages/StudentsPage.ts
 * Page Object para el módulo de Estudiantes (/estudiantes y /estudiantes/:id).
 */

import type { Page } from '@playwright/test';

export class StudentsPage {
  constructor(public readonly page: Page) {}

  // ── Navegación ──────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/estudiantes');
    await this.page.waitForLoadState('load');
  }

  /** Navega directamente al perfil de un estudiante por su id (/estudiantes/:id). */
  async gotoPerfil(studentId: string) {
    await this.page.goto(`/estudiantes/${studentId}`);
    await this.page.waitForLoadState('load');
  }

  // ── Locators (lista) ──────────────────────────────────────────────────────

  get heading() {
    return this.page.getByRole('heading', { name: /estudiantes/i });
  }

  get btnNuevoEstudiante() {
    return this.page.getByRole('button', { name: /nuevo estudiante/i });
  }

  get inputBusqueda() {
    return this.page.getByPlaceholder(/buscar/i);
  }

  get mensajeSinResultados() {
    return this.page.getByText(/no hay estudiantes que coincidan/i);
  }

  get dialog() {
    return this.page.getByRole('dialog');
  }

  get btnGuardar() {
    return this.dialog.getByRole('button', { name: /guardar/i });
  }

  nombreEnLista(nombre: string) {
    return this.page.getByRole('cell', { name: new RegExp(nombre, 'i') });
  }

  /**
   * Fila clickeable de la tabla que contiene el nombre indicado.
   * Las filas se renderizan como <tr role="button"> (abren el perfil al clic),
   * por eso se localizan por el rol button y no por row.
   */
  filaEstudiante(nombre: string) {
    return this.page.getByRole('button').filter({ hasText: new RegExp(nombre, 'i') });
  }

  /** Badge de estado de pago de un estudiante por su id. */
  badgePago(studentId: string) {
    return this.page.getByTestId(`payment-badge-${studentId}`);
  }

  // ── Locators (perfil / historial de pagos) ──────────────────────────────────

  get headingHistorialPagos() {
    return this.page.getByRole('heading', { name: /historial de pagos/i });
  }

  /** Botón (icono) de descarga de comprobante de un pago por su número. */
  botonDescargarComprobante(receiptNo: string) {
    return this.page.getByRole('button', {
      name: new RegExp(`descargar comprobante ${receiptNo}`, 'i'),
    });
  }

  // ── Acciones ────────────────────────────────────────────────────────────────

  async abrirFormularioNuevoEstudiante() {
    await this.btnNuevoEstudiante.click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  async buscar(termino: string) {
    await this.inputBusqueda.fill(termino);
  }

  async llenarCampo(label: string | RegExp, valor: string) {
    await this.dialog.getByLabel(label).fill(valor);
  }

  async seleccionarEnCombo(nombreOpcion: string | RegExp) {
    await this.dialog.getByRole('combobox').first().click();
    await this.page.getByRole('option', { name: nombreOpcion }).click();
  }

  async registrarEstudiante(datos: {
    nombres: string;
    apellidos: string;
    documento: string;
    plan: string | RegExp;
    vencimiento: string;
  }) {
    await this.llenarCampo(/nombres/i, datos.nombres);
    await this.llenarCampo(/apellidos/i, datos.apellidos);
    await this.llenarCampo(/documento/i, datos.documento);
    await this.seleccionarEnCombo(datos.plan);
    await this.llenarCampo(/vencimiento/i, datos.vencimiento);
    await this.btnGuardar.click();
  }

  async abrirPerfilDe(nombre: string) {
    await this.filaEstudiante(nombre).click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  async filtrarPorEstadoDePago(opcion: string | RegExp) {
    await this.page.getByRole('combobox').first().click();
    await this.page.getByRole('option', { name: opcion }).click();
  }
}
