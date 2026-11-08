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

  async escribirDescuento(valor: string) {
    await this.dialog.getByLabel(/descuento \(monto\)/i).fill(valor);
  }
}
