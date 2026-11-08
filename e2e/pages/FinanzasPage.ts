/**
 * pages/FinanzasPage.ts
 * Page Object de /finanzas: resumen, traslados y las pestañas Ventas e Inventario.
 */

import type { Page } from '@playwright/test';

export class FinanzasPage {
  constructor(public readonly page: Page) {}

  async goto() {
    await this.page.goto('/finanzas');
    await this.page.waitForLoadState('load');
  }

  async abrirPestana(nombre: RegExp) {
    await this.goto();
    await this.page.getByRole('tab', { name: nombre }).click();
  }

  get panel() {
    return this.page.getByRole('tabpanel');
  }

  get dialog() {
    return this.page.getByRole('dialog');
  }

  get erroresFormulario() {
    return this.page.locator('[data-slot="form-message"]');
  }

  /** Espera a que cualquier escritura asíncrona termine antes de afirmar que no ocurrió. */
  async asentar() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(300);
  }

  // ── Traslados ──────────────────────────────────────────────────────────────

  get btnTraslado() {
    return this.page.getByRole('button', { name: 'Registrar traslado' });
  }

  async registrarTraslado(monto: string) {
    await this.page.getByLabel('Monto').fill(monto);
    await this.btnTraslado.click();
  }

  async elegirCajaDestino(nombre: RegExp) {
    await this.page.getByRole('combobox', { name: /caja destino/i }).click();
    await this.page.getByRole('option', { name: nombre }).click();
  }

  // ── Ventas ─────────────────────────────────────────────────────────────────

  async llenarVenta(cantidad: string, item: string, cliente: string) {
    await this.panel.getByLabel(/cliente/i).first().fill(cliente);
    await this.panel.getByRole('combobox', { name: 'Ítem 1' }).click();
    await this.page.getByRole('option', { name: new RegExp(item, 'i') }).click();
    await this.panel.getByLabel('Cantidad 1').fill(cantidad);
  }

  async elegirCredito() {
    await this.panel.getByRole('combobox').filter({ hasText: 'Contado' }).click();
    await this.page.getByRole('option', { name: /crédito/i }).click();
  }

  get btnVenta() {
    return this.panel.getByRole('button', { name: 'Registrar venta' });
  }

  // ── Inventario ─────────────────────────────────────────────────────────────

  async llenarItem(datos: { nombre: string; costo: string; precio: string; stock: string }) {
    await this.dialog.getByLabel(/nombre/i).fill(datos.nombre);
    await this.dialog.getByLabel(/costo/i).fill(datos.costo);
    await this.dialog.getByLabel(/precio/i).fill(datos.precio);
    await this.dialog.getByLabel(/stock/i).fill(datos.stock);
    await this.dialog.getByRole('button', { name: /guardar/i }).click();
  }

  filaItem(nombre: string) {
    return this.panel.getByRole('row').filter({ hasText: nombre });
  }
}
