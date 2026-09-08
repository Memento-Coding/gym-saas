/**
 * InventoryService.test.ts — Tests unitarios y property-based (Track C, Issue 15.1).
 *
 * Cubre (Requirements 8.1–8.6):
 *  - CRUD diferenciando Productos (con stock) de Servicios (stock null).
 *  - Descuento automático de stock al aplicar una venta.
 *  - Rechazo de ventas con stock insuficiente (sin mutar el inventario).
 *  - Incremento de stock por reabastecimiento.
 *  - Propiedad: el stock nunca queda negativo y se conserva (stock final =
 *    stock inicial - vendido + reabastecido).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

import { InventoryService } from '@/services/InventoryService';
import type { StorageService } from '@/services/storage/StorageService';
import type { InventoryItem } from '@/types/inventory';
import type { SaleItem } from '@/types/sale';

// =============================================================================
// StorageService en memoria para aislar la lógica
// =============================================================================

function createInMemoryStorage(): StorageService {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | null> {
      return store.has(key) ? (store.get(key) as T) : null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, JSON.parse(JSON.stringify(value)));
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async keys(): Promise<string[]> {
      return Array.from(store.keys());
    },
    async exportAll(): Promise<Record<string, unknown>> {
      return Object.fromEntries(store.entries());
    },
    async importAll(data: Record<string, unknown>): Promise<void> {
      store.clear();
      for (const [k, v] of Object.entries(data)) store.set(k, v);
    },
    async clear(preserveKeys?: string[]): Promise<void> {
      for (const k of Array.from(store.keys())) {
        if (!preserveKeys?.includes(k)) store.delete(k);
      }
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

let storage: StorageService;
let service: InventoryService;

beforeEach(() => {
  storage = createInMemoryStorage();
  service = new InventoryService(storage);
});

/** Crea un producto y devuelve el ítem creado (falla el test si no se crea). */
async function createProduct(name: string, stock: number, price = 10000): Promise<InventoryItem> {
  const result = await service.create({ kind: 'product', name, cost: 5000, price, stock });
  if (!result.success) throw new Error(result.error);
  return result.data;
}

function saleLine(item: InventoryItem, quantity: number): SaleItem {
  return {
    inventoryId: item.id,
    name: item.name,
    quantity,
    unitPrice: item.price,
    subtotal: item.price * quantity,
  };
}

// =============================================================================
// CRUD — Productos vs Servicios (Req 8.1)
// =============================================================================

describe('InventoryService — CRUD productos vs servicios', () => {
  it('crea un producto con stock numérico', async () => {
    const result = await service.create({
      kind: 'product',
      name: 'Guantes',
      cost: 20000,
      price: 45000,
      stock: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('product');
      expect(result.data.stock).toBe(10);
      expect(result.data.id).toBeTruthy();
    }
  });

  it('crea un servicio con stock null (aunque se envíe un número)', async () => {
    const result = await service.create({
      kind: 'service',
      name: 'Clase personalizada',
      cost: 0,
      price: 30000,
      stock: 99, // debe ignorarse
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('service');
      expect(result.data.stock).toBeNull();
    }
  });

  it('rechaza crear un producto sin stock inicial válido', async () => {
    const result = await service.create({
      kind: 'product',
      name: 'Vendas',
      cost: 1000,
      price: 3000,
      stock: null,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un producto con stock negativo o no entero', async () => {
    expect((await service.create({ kind: 'product', name: 'A', cost: 1, price: 2, stock: -1 })).success).toBe(false);
    expect((await service.create({ kind: 'product', name: 'B', cost: 1, price: 2, stock: 2.5 })).success).toBe(false);
  });

  it('rechaza nombre vacío, costo o precio negativos', async () => {
    expect((await service.create({ kind: 'service', name: '  ', cost: 0, price: 0 })).success).toBe(false);
    expect((await service.create({ kind: 'product', name: 'X', cost: -1, price: 2, stock: 1 })).success).toBe(false);
    expect((await service.create({ kind: 'product', name: 'X', cost: 1, price: -2, stock: 1 })).success).toBe(false);
  });

  it('getProducts y getServices filtran por kind', async () => {
    await createProduct('Producto 1', 5);
    await service.create({ kind: 'service', name: 'Servicio 1', cost: 0, price: 100 });

    const products = await service.getProducts();
    const services = await service.getServices();
    expect(products).toHaveLength(1);
    expect(services).toHaveLength(1);
    expect(products[0].kind).toBe('product');
    expect(services[0].kind).toBe('service');
  });

  it('getById devuelve el ítem o null', async () => {
    const p = await createProduct('Buscable', 3);
    expect((await service.getById(p.id))?.id).toBe(p.id);
    expect(await service.getById('no-existe')).toBeNull();
  });

  it('update modifica campos y preserva coherencia de stock', async () => {
    const p = await createProduct('Editable', 5);
    const result = await service.update(p.id, { name: 'Editado', stock: 8 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Editado');
      expect(result.data.stock).toBe(8);
    }
  });

  it('update fuerza stock null si el ítem es servicio', async () => {
    const s = await service.create({ kind: 'service', name: 'Serv', cost: 0, price: 10 });
    if (!s.success) throw new Error('setup');
    const result = await service.update(s.data.id, { stock: 50 } as Partial<InventoryItem>);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stock).toBeNull();
  });

  it('update falla para id inexistente', async () => {
    expect((await service.update('nope', { name: 'x' })).success).toBe(false);
  });

  it('delete elimina el ítem o falla si no existe', async () => {
    const p = await createProduct('Eliminable', 1);
    expect((await service.delete(p.id)).success).toBe(true);
    expect(await service.getById(p.id)).toBeNull();
    expect((await service.delete(p.id)).success).toBe(false);
  });
});

// =============================================================================
// Descuento de stock al vender (Req 8.2)
// =============================================================================

describe('InventoryService — descuento de stock por venta', () => {
  it('descuenta el stock del producto vendido', async () => {
    const p = await createProduct('Camiseta', 10);
    const result = await service.applySale([saleLine(p, 3)]);
    expect(result.success).toBe(true);

    const updated = await service.getById(p.id);
    expect(updated?.stock).toBe(7);
  });

  it('descuenta correctamente al vender varios productos en una venta', async () => {
    const a = await createProduct('A', 10);
    const b = await createProduct('B', 5);
    const result = await service.applySale([saleLine(a, 2), saleLine(b, 5)]);
    expect(result.success).toBe(true);

    expect((await service.getById(a.id))?.stock).toBe(8);
    expect((await service.getById(b.id))?.stock).toBe(0);
  });

  it('agrega cantidades cuando el mismo producto aparece en varias líneas', async () => {
    const p = await createProduct('Repetido', 10);
    const result = await service.applySale([saleLine(p, 2), saleLine(p, 3)]);
    expect(result.success).toBe(true);
    expect((await service.getById(p.id))?.stock).toBe(5);
  });

  it('no descuenta stock a los servicios (stock null)', async () => {
    const s = await service.create({ kind: 'service', name: 'Asesoría', cost: 0, price: 50000 });
    if (!s.success) throw new Error('setup');
    const line: SaleItem = {
      inventoryId: s.data.id,
      name: 'Asesoría',
      quantity: 3,
      unitPrice: 50000,
      subtotal: 150000,
    };
    const result = await service.applySale([line]);
    expect(result.success).toBe(true);
    expect((await service.getById(s.data.id))?.stock).toBeNull();
  });

  it('rechaza venta con cantidad <= 0', async () => {
    const p = await createProduct('C', 5);
    expect((await service.applySale([saleLine(p, 0)])).success).toBe(false);
    expect((await service.applySale([saleLine(p, -2)])).success).toBe(false);
  });

  it('rechaza venta vacía o de ítem inexistente', async () => {
    expect((await service.applySale([])).success).toBe(false);
    const ghost: SaleItem = { inventoryId: 'ghost', name: 'X', quantity: 1, unitPrice: 1, subtotal: 1 };
    expect((await service.applySale([ghost])).success).toBe(false);
  });
});

// =============================================================================
// Bloqueo por stock insuficiente (Req 8.3)
// =============================================================================

describe('InventoryService — bloqueo por stock insuficiente', () => {
  it('rechaza la venta si se pide más de lo disponible', async () => {
    const p = await createProduct('Limitado', 2);
    const result = await service.applySale([saleLine(p, 5)]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/stock insuficiente/i);
    }
  });

  it('no modifica el stock cuando la venta se rechaza (atómica)', async () => {
    const p = await createProduct('Intacto', 2);
    await service.applySale([saleLine(p, 5)]);
    expect((await service.getById(p.id))?.stock).toBe(2); // sin cambios
  });

  it('rechaza la venta completa si UNA línea excede el stock (no aplica ninguna)', async () => {
    const ok = await createProduct('OK', 10);
    const bad = await createProduct('BAD', 1);
    const result = await service.applySale([saleLine(ok, 3), saleLine(bad, 5)]);
    expect(result.success).toBe(false);

    // Ninguno de los dos productos debe haber cambiado.
    expect((await service.getById(ok.id))?.stock).toBe(10);
    expect((await service.getById(bad.id))?.stock).toBe(1);
  });

  it('permite vender exactamente todo el stock disponible', async () => {
    const p = await createProduct('Exacto', 4);
    const result = await service.applySale([saleLine(p, 4)]);
    expect(result.success).toBe(true);
    expect((await service.getById(p.id))?.stock).toBe(0);
  });

  it('hasStock refleja disponibilidad', async () => {
    const p = await createProduct('Disp', 3);
    expect(await service.hasStock(p.id, 3)).toBe(true);
    expect(await service.hasStock(p.id, 4)).toBe(false);
    expect(await service.hasStock('ghost', 1)).toBe(false);
  });
});

// =============================================================================
// Reabastecimiento (Req 8.4)
// =============================================================================

describe('InventoryService — reabastecimiento (restock)', () => {
  it('incrementa el stock de un producto', async () => {
    const p = await createProduct('Reabastecible', 5);
    const result = await service.restock(p.id, 10);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stock).toBe(15);
  });

  it('rechaza reabastecer con cantidad no positiva o no entera', async () => {
    const p = await createProduct('R', 5);
    expect((await service.restock(p.id, 0)).success).toBe(false);
    expect((await service.restock(p.id, -3)).success).toBe(false);
    expect((await service.restock(p.id, 2.5)).success).toBe(false);
  });

  it('rechaza reabastecer un servicio', async () => {
    const s = await service.create({ kind: 'service', name: 'Serv', cost: 0, price: 10 });
    if (!s.success) throw new Error('setup');
    expect((await service.restock(s.data.id, 5)).success).toBe(false);
  });

  it('rechaza reabastecer un ítem inexistente', async () => {
    expect((await service.restock('ghost', 5)).success).toBe(false);
  });

  it('permite vender de nuevo tras reabastecer', async () => {
    const p = await createProduct('Ciclo', 2);
    await service.applySale([saleLine(p, 2)]); // stock → 0
    expect((await service.getById(p.id))?.stock).toBe(0);

    await service.restock(p.id, 5); // stock → 5
    const result = await service.applySale([saleLine(p, 4)]);
    expect(result.success).toBe(true);
    expect((await service.getById(p.id))?.stock).toBe(1);
  });
});

// =============================================================================
// Property-based tests (fast-check)
// =============================================================================

describe('InventoryService — propiedades', () => {
  it('[PROPERTY] una venta válida deja stock = inicial - vendido, nunca negativo', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1000 }), // stock inicial
        fc.integer({ min: 1, max: 1000 }), // cantidad a vender
        async (inicial, vender) => {
          const s = createInMemoryStorage();
          const svc = new InventoryService(s);
          const created = await svc.create({
            kind: 'product',
            name: 'Prop',
            cost: 1,
            price: 2,
            stock: inicial,
          });
          if (!created.success) return false;

          const line = saleLine(created.data, vender);
          const result = await svc.applySale([line]);
          const after = await svc.getById(created.data.id);

          if (vender <= inicial) {
            // Venta válida: stock desciende exactamente y nunca es negativo.
            return (
              result.success === true &&
              after?.stock === inicial - vender &&
              (after?.stock ?? 0) >= 0
            );
          }
          // Venta que excede: rechazada y stock intacto.
          return result.success === false && after?.stock === inicial;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('[PROPERTY] vender y luego reabastecer conserva la aritmética del stock', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 500 }),
        async (inicial, vender, reabastecer) => {
          const s = createInMemoryStorage();
          const svc = new InventoryService(s);
          const created = await svc.create({
            kind: 'product',
            name: 'Prop2',
            cost: 1,
            price: 2,
            stock: inicial,
          });
          if (!created.success) return false;

          let esperado = inicial;

          if (vender > 0) {
            const sale = await svc.applySale([saleLine(created.data, vender)]);
            if (vender <= inicial) {
              if (!sale.success) return false;
              esperado -= vender;
            } else {
              if (sale.success) return false; // debió rechazar
            }
          }

          const restock = await svc.restock(created.data.id, reabastecer);
          if (!restock.success) return false;
          esperado += reabastecer;

          const after = await svc.getById(created.data.id);
          return after?.stock === esperado && (after?.stock ?? -1) >= 0;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('[PROPERTY] los servicios nunca alteran su stock null al venderse', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async (qty) => {
        const s = createInMemoryStorage();
        const svc = new InventoryService(s);
        const created = await svc.create({ kind: 'service', name: 'S', cost: 0, price: 10 });
        if (!created.success) return false;

        const line: SaleItem = {
          inventoryId: created.data.id,
          name: 'S',
          quantity: qty,
          unitPrice: 10,
          subtotal: 10 * qty,
        };
        const result = await svc.applySale([line]);
        const after = await svc.getById(created.data.id);
        return result.success === true && after?.stock === null;
      }),
      { numRuns: 100 },
    );
  });
});
