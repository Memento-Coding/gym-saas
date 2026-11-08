/**
 * pages/PagosPage.ts
 * Page Object del registro de pagos en /estudiantes/:id.
 */

import type { Page } from '@playwright/test';

export class PagosPage {
  constructor(public readonly page: Page) {}

  async abrir(studentId: string) {
    await this.page.goto(`/estudiantes/${studentId}`);
    await this.page.getByRole('button', { name: 'Registrar pago' }).click();
    await this.dialog.waitFor({ state: 'visible' });
  }

  get dialog() {
    return this.page.getByRole('dialog');
  }

  get btnConfirmar() {
    return this.dialog.getByRole('button', { name: 'Registrar pago' });
  }

  get erroresFormulario() {
    return this.dialog.locator('[data-slot="form-message"]');
  }

  async elegirPrimerPlan() {
    await this.dialog.getByRole('combobox', { name: /plan/i }).first().click();
    await this.page.getByRole('option').first().click();
  }

  /** Total a pagar del plan elegido, tal como lo muestra el formulario. */
  async totalAPagar() {
    const fila = this.dialog.getByText('Total a pagar').locator('..');
    return Number((await fila.innerText()).replace(/\D/g, ''));
  }

  /** Activa el pago dividido con dos partes y escribe sus montos. */
  async dividir(primero: number, segundo: number) {
    await this.dialog.locator('#split-toggle').click();
    const montos = this.dialog.locator('input[inputmode="numeric"]');
    const agregar = this.dialog.getByRole('button', { name: /agregar método/i });
    const fijos = 1; // el descuento
    while ((await montos.count()) < fijos + 2) await agregar.click();
    await montos.nth(-2).fill(String(primero));
    await montos.nth(-1).fill(String(segundo));
  }

  async elegirCredito() {
    await this.dialog.getByRole('combobox', { name: /tipo de pago/i }).click();
    await this.page.getByRole('option', { name: /crédito/i }).click();
  }

  async escribirDescuento(valor: string) {
    await this.dialog.getByLabel(/descuento \(monto\)/i).fill(valor);
  }
}
