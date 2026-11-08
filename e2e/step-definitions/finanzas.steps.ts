/**
 * step-definitions/finanzas.steps.ts
 * Steps para: features/ventas, features/inventario y features/finanzas.
 */

import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { FinanzasPage } from '../pages/FinanzasPage';
import { lsGet, seedAll } from '../helpers/seed';
import { diasDesdeHoy } from '../helpers/dates';

let finanzas: FinanzasPage;

type Item = { id: string; name: string; price: number; stock: number | null };
type Movimiento = { type: string; amount: number };

const items = () => lsGet<Item[]>(finanzas.page, 'inventory_items').then((l) => l ?? []);
type Venta = { type: string; creditPlan?: { installments: unknown[] } };
const ventas = () => lsGet<Venta[]>(finanzas.page, 'sales').then((l) => l ?? []);
const movimientos = () => lsGet<Movimiento[]>(finanzas.page, 'finance_movements').then((l) => l ?? []);

Given(
  'que hay en inventario {int} unidades de {string} y el servicio {string}',
  async ({ page }, stock: number, producto: string, servicio: string) => {
    finanzas = new FinanzasPage(page);
    await seedAll(page, {
      inventory_items: [
        { id: 'p-e2e', kind: 'product', name: producto, cost: 20000, price: 35000, stock },
        { id: 's-e2e', kind: 'service', name: servicio, cost: 0, price: 50000, stock: null },
      ],
    });
  },
);

When('entra a la sección de ventas', async () => {
  await finanzas.abrirPestana(/^ventas$/i);
});

When('entra a la sección de inventario', async () => {
  await finanzas.abrirPestana(/^inventario$/i);
});

When('accede al módulo de finanzas', async ({ page }) => {
  finanzas = new FinanzasPage(page);
  await finanzas.goto();
});

// ── Ventas ───────────────────────────────────────────────────────────────────

When('vende {int} de {string} al cliente {string}', async ({}, n: number, item: string, cliente: string) => {
  await finanzas.llenarVenta(String(n), item, cliente);
  await finanzas.btnVenta.click();
});

When('vende con doble clic {int} de {string} al cliente {string}', async ({}, n: number, item: string, cliente: string) => {
  await finanzas.llenarVenta(String(n), item, cliente);
  await finanzas.btnVenta.dblclick();
});

When('intenta vender {string} de {string} al cliente {string}', async ({}, cantidad: string, item: string, cliente: string) => {
  await finanzas.llenarVenta(cantidad, item, cliente);
  await finanzas.btnVenta.click();
});

When('intenta vender a crédito {string} de {string} al cliente {string}', async ({}, cantidad: string, item: string, cliente: string) => {
  await finanzas.llenarVenta(cantidad, item, cliente);
  await finanzas.elegirCredito();
  await finanzas.btnVenta.click();
});

Then('debería existir {int} venta registrada', async ({}, n: number) => {
  await finanzas.asentar();
  expect(await ventas()).toHaveLength(n);
});

Then('no debería existir ninguna venta registrada', async () => {
  await finanzas.asentar();
  expect(await ventas()).toHaveLength(0);
});

Then('el stock de {string} debería ser {int}', async ({}, nombre: string, stock: number) => {
  await finanzas.asentar();
  expect((await items()).find((i) => i.name === nombre)?.stock).toBe(stock);
});

// ── Inventario ───────────────────────────────────────────────────────────────

When(
  'crea el producto {string} con costo {string} precio {string} y stock {string}',
  async ({}, nombre: string, costo: string, precio: string, stock: string) => {
    await finanzas.panel.getByRole('button', { name: 'Nuevo ítem' }).click();
    await finanzas.llenarItem({ nombre, costo, precio, stock });
  },
);

When('cambia el stock de {string} a {string}', async ({}, nombre: string, stock: string) => {
  await finanzas.filaItem(nombre).getByRole('button', { name: /editar/i }).click();
  await finanzas.dialog.getByLabel(/stock/i).fill(stock);
  await finanzas.dialog.getByRole('button', { name: /guardar/i }).click();
});

When('intenta eliminar {string} y cancela la confirmación', async ({ page }, nombre: string) => {
  page.once('dialog', (d) => d.dismiss());
  await finanzas.filaItem(nombre).getByRole('button', { name: /eliminar/i }).click();
});

When(
  'vende a crédito {int} de {string} al cliente {string} con vencimiento en {int} días',
  async ({}, n: number, item: string, cliente: string, dias: number) => {
    await finanzas.llenarVenta(String(n), item, cliente);
    await finanzas.elegirCredito();
    await finanzas.panel.locator('#credit-date').fill(diasDesdeHoy(dias));
    await finanzas.btnVenta.click();
  },
);

When('elimina {string} confirmando la acción', async ({ page }, nombre: string) => {
  page.once('dialog', (d) => d.accept());
  await finanzas.filaItem(nombre).getByRole('button', { name: /eliminar/i }).click();
});

Then('debería existir {int} venta a crédito con {int} cuota', async ({}, n: number, cuotas: number) => {
  await finanzas.asentar();
  const lista = await ventas();
  expect(lista).toHaveLength(n);
  expect(lista[0].type).toBe('credit');
  expect(lista[0].creditPlan?.installments).toHaveLength(cuotas);
});

Then('debería ver {string} en el inventario', async ({}, nombre: string) => {
  await expect(finanzas.filaItem(nombre)).toBeVisible();
});

Then('debería existir el ítem {string} con precio {int} y stock {int}', async ({}, nombre: string, precio: number, stock: number) => {
  await finanzas.asentar();
  const item = (await items()).find((i) => i.name === nombre);
  expect(item?.price).toBe(precio);
  expect(item?.stock).toBe(stock);
});

Then('no debería existir el ítem {string}', async ({}, nombre: string) => {
  await finanzas.asentar();
  expect((await items()).filter((i) => i.name === nombre && nombre !== '')).toHaveLength(0);
});

Then('el catálogo debería seguir teniendo {int} ítems', async ({}, n: number) => {
  await finanzas.asentar();
  expect(await items()).toHaveLength(n);
});

// ── Traslados ────────────────────────────────────────────────────────────────

When('registra un traslado de {string}', async ({}, monto: string) => {
  await finanzas.registrarTraslado(monto);
});

When('registra un traslado de {string} hacia la misma caja', async ({}, monto: string) => {
  await finanzas.elegirCajaDestino(/servicios/i);
  await finanzas.registrarTraslado(monto);
});

Then('debería ver el resumen de ingresos y egresos', async ({ page }) => {
  await expect(page.getByText('Ingresos', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Egresos', { exact: true }).first()).toBeVisible();
});

Then('deberían existir {int} movimientos de traslado por {int}', async ({}, n: number, monto: number) => {
  await finanzas.asentar();
  const lista = await movimientos();
  expect(lista).toHaveLength(n);
  expect(lista.every((m) => m.type === 'transfer' && m.amount === monto)).toBe(true);
});

Then('el balance total debería seguir en cero', async ({ page }) => {
  await expect(page.getByText('Balance', { exact: true }).first().locator('..').locator('..')).toContainText('$ 0');
});

Then('no debería existir ningún movimiento', async () => {
  await finanzas.asentar();
  expect(await movimientos()).toHaveLength(0);
});

Then('debería ver un error en el formulario de traslado', async () => {
  await expect(finanzas.erroresFormulario.first()).toBeVisible();
});
