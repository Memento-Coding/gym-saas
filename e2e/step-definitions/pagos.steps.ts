/**
 * step-definitions/pagos.steps.ts
 * Steps para: features/pagos/registro-pagos.feature
 */

import { expect, type Download } from '@playwright/test';
import { When, Then } from '../support/world';
import { PagosPage } from '../pages/PagosPage';
import { TEST_STUDENT } from '../fixtures/students';
import { lsGet } from '../helpers/seed';
import { diasDesdeHoy } from '../helpers/dates';

let pagos: PagosPage;
let descarga: Promise<Download | null>;

type Pago = { amount: number; discount: number; status: string; splits?: unknown[] };
type Movimiento = { type: string; category: string; amount: number };

async function pagosGuardados(p: PagosPage) {
  await p.page.waitForTimeout(400);
  return (await lsGet<Pago[]>(p.page, 'payments')) ?? [];
}

When('abre el registro de pago del estudiante', async ({ page }) => {
  pagos = new PagosPage(page);
  await pagos.abrir(TEST_STUDENT.id);
});

When('confirma un pago del primer plan con descuento {string}', async ({ page }, descuento: string) => {
  descarga = page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
  await pagos.elegirPrimerPlan();
  await pagos.escribirDescuento(descuento);
  await pagos.btnConfirmar.click();
});

When('confirma un pago del primer plan con fecha de pago en {int} días', async ({}, dias: number) => {
  await pagos.elegirPrimerPlan();
  await pagos.dialog.getByLabel('Fecha de pago').fill(diasDesdeHoy(dias));
  await pagos.btnConfirmar.click();
});

When('confirma el pago sin elegir un plan', async () => {
  await pagos.btnConfirmar.click();
});

When('confirma con doble clic un pago del primer plan', async () => {
  await pagos.elegirPrimerPlan();
  await pagos.btnConfirmar.dblclick();
});

Then('debería existir {int} pago registrado con descuento {int}', async ({}, n: number, descuento: number) => {
  const lista = await pagosGuardados(pagos);
  expect(lista).toHaveLength(n);
  expect(lista[0].discount).toBe(descuento);
});

Then('no debería existir ningún pago registrado', async () => {
  expect(await pagosGuardados(pagos)).toHaveLength(0);
});

Then('no debería descargarse nada sin pedirlo', async () => {
  expect(await descarga).toBeNull();
});

Then('debería poder descargar su comprobante desde el aviso', async ({ page }) => {
  const archivo = page.waitForEvent('download');
  await page.getByRole('button', { name: /descargar comprobante/i }).first().click();
  expect((await archivo).suggestedFilename()).toMatch(/^comprobante_GOP-.*\.pdf$/);
});

Then('debería existir un ingreso por el valor neto del pago', async () => {
  const [pago] = await pagosGuardados(pagos);
  const movimientos = (await lsGet<Movimiento[]>(pagos.page, 'finance_movements')) ?? [];
  expect(movimientos).toEqual([
    expect.objectContaining({ type: 'income', category: 'Mensualidades', amount: pago.amount - pago.discount }),
  ]);
});

Then('el formulario de pago debería seguir abierto mostrando un error', async () => {
  await expect(pagos.dialog).toBeVisible();
  await expect(pagos.erroresFormulario.first()).toBeVisible();
});

When('confirma un pago del primer plan dividido en dos partes que suman el total', async () => {
  await pagos.elegirPrimerPlan();
  const total = await pagos.totalAPagar();
  await pagos.dividir(total - 1000, 1000);
  await pagos.btnConfirmar.click();
});

When('confirma un pago del primer plan dividido en dos partes que no suman el total', async () => {
  await pagos.elegirPrimerPlan();
  await pagos.dividir(1, 2);
  if (await pagos.btnConfirmar.isEnabled()) await pagos.btnConfirmar.click();
});

When('confirma un pago a crédito del primer plan con abono {string}', async ({}, abono: string) => {
  await pagos.elegirPrimerPlan();
  await pagos.elegirCredito();
  await pagos.dialog.getByLabel(/abono inicial/i).fill(abono);
  await pagos.btnConfirmar.click();
});

Then('debería existir {int} pago registrado con {int} partes', async ({}, n: number, partes: number) => {
  const lista = await pagosGuardados(pagos);
  expect(lista).toHaveLength(n);
  expect(lista[0].splits).toHaveLength(partes);
});

Then('debería existir {int} pago registrado a crédito', async ({}, n: number) => {
  const lista = await pagosGuardados(pagos);
  expect(lista).toHaveLength(n);
  expect(lista[0].status).toBe('credit');
});
