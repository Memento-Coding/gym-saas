/**
 * #99 — Un formulario de edición abierto no debe revertir el stock.
 *
 * Escenario: se abre la edición con stock X, una venta lo baja a X-1 y el
 * usuario guarda cambiando solo nombre/precio. El stock debe quedar en X-1.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InventoryService, planInventoryEdit } from '@/services/InventoryService';
import type { StorageService } from '@/services/storage/StorageService';
import type { InventoryItem } from '@/types/inventory';
import type { SaleItem } from '@/types/sale';

// ── Servidor falso: mantiene el stock real y aplica los movimientos ─────────
const server = vi.hoisted(() => ({
  items: [] as Array<Record<string, unknown>>,
}));
vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(async () => structuredClone(server.items)),
    put: vi.fn(async (path: string, body: Record<string, unknown>) => {
      const id = decodeURIComponent(path.split('/')[2]);
      const { stock: _ignored, ...rest } = body; // el PUT ignora stock
      void _ignored;
      server.items = server.items.map((i) => (i.id === id ? { ...i, ...rest } : i));
      return {};
    }),
    post: vi.fn(async (path: string, body: Record<string, unknown>) => {
      const [, , id, action] = path.split('/');
      if (action === 'stock') {
        const q = body.quantity as number;
        server.items = server.items.map((i) =>
          i.id === decodeURIComponent(id)
            ? { ...i, stock: (i.stock as number) + (body.operation === 'increment' ? q : -q) }
            : i,
        );
      }
      return {};
    }),
    delete: vi.fn(),
  },
}));

import { InventoryResource } from '@/services/api/resources/inventoryResource';

const X = 10;
const ITEM_ID = 'a';
const initial: InventoryItem = { id: ITEM_ID, kind: 'product', name: 'Guantes', cost: 10, price: 20, stock: X };
const sale: SaleItem[] = [
  { inventoryId: ITEM_ID, name: 'Guantes', quantity: 1, unitPrice: 20 } as unknown as SaleItem,
];

/** Los dos modos: local (memoria) y API (servidor falso). */
function makeLocal(): { svc: InventoryService; stock: () => Promise<number | null> } {
  const store = new Map<string, unknown>([['inventory_items', [structuredClone(initial)]]]);
  const storage = {
    get: async (k: string) => structuredClone(store.get(k) ?? null),
    set: async (k: string, v: unknown) => void store.set(k, structuredClone(v)),
  } as unknown as StorageService;
  const svc = new InventoryService(storage);
  return { svc, stock: async () => (await svc.getById(ITEM_ID))!.stock };
}

function makeApi(): { svc: InventoryService; stock: () => Promise<number | null> } {
  server.items = [{ id: ITEM_ID, type: 'product', name: 'Guantes', cost: 10, price: 20, stock: X }];
  const resource = new InventoryResource();
  // El adaptador de la API enruta por clave y llama al handler sin ella.
  const storage = {
    get: () => resource.get(),
    set: (_key: string, value: unknown) => resource.set(value),
  } as unknown as StorageService;
  const svc = new InventoryService(storage);
  return { svc, stock: async () => server.items[0].stock as number };
}

describe.each([
  ['local', makeLocal],
  ['API', makeApi],
])('edición concurrente de inventario (%s)', (_mode, make) => {
  let env: ReturnType<typeof make>;
  beforeEach(() => {
    env = make();
  });

  /** Replica lo que hace InventoryTab al guardar una edición. */
  async function save(opened: InventoryItem, formInput: Parameters<typeof planInventoryEdit>[1]) {
    const { changes, stockDelta } = planInventoryEdit(opened, formInput);
    const r = await env.svc.update(opened.id, changes);
    if (r.success && stockDelta !== 0) return env.svc.adjustStock(opened.id, stockDelta);
    return r;
  }

  it('cambiar solo el nombre/precio no revierte la venta concurrente', async () => {
    const opened = (await env.svc.getById(ITEM_ID))!; // 1. se abre con stock X
    await env.svc.applySale(sale); // 2. venta concurrente: X-1
    expect(await env.stock()).toBe(X - 1);

    // 3. el formulario no tocó el stock: no lo envía (ver InventoryForm)
    const result = await save(opened, { kind: 'product', name: 'Guantes Pro', cost: 10, price: 25 });
    expect(result.success).toBe(true);

    expect(await env.stock()).toBe(X - 1); // 4. no se revierte a X
    const after = await env.svc.getById(ITEM_ID);
    expect(after).toMatchObject({ name: 'Guantes Pro', price: 25 });
  });

  it('si el usuario edita el stock se aplica su variación sobre el valor vigente', async () => {
    const opened = (await env.svc.getById(ITEM_ID))!;
    await env.svc.applySale(sale); // X-1
    // El usuario vio X y escribió X+5: +5 sobre lo vigente.
    await save(opened, { kind: 'product', name: 'Guantes', cost: 10, price: 20, stock: X + 5 });
    expect(await env.stock()).toBe(X - 1 + 5);
  });

  it('reducir el stock explícitamente también aplica la variación', async () => {
    const opened = (await env.svc.getById(ITEM_ID))!;
    await save(opened, { kind: 'product', name: 'Guantes', cost: 10, price: 20, stock: X - 4 });
    expect(await env.stock()).toBe(X - 4);
  });

  it('un ajuste que dejaría el stock negativo se rechaza sin cambiar nada', async () => {
    const opened = (await env.svc.getById(ITEM_ID))!;
    await env.svc.applySale([{ ...sale[0], quantity: 9 } as SaleItem]); // queda 1
    const r = await save(opened, { kind: 'product', name: 'Guantes', cost: 10, price: 20, stock: 0 });
    expect(r.success).toBe(false);
    expect(await env.stock()).toBe(1);
  });
});

describe('planInventoryEdit', () => {
  const edit = { kind: 'product' as const, name: 'a', cost: 1, price: 1 };

  it('sin stock en el input no hay variación', () => {
    expect(planInventoryEdit({ kind: 'product', stock: 5 }, edit)).toEqual({ changes: edit, stockDelta: 0 });
  });

  it('con stock calcula la diferencia y lo quita de los cambios', () => {
    const { changes, stockDelta } = planInventoryEdit({ kind: 'product', stock: 5 }, { ...edit, stock: 8 });
    expect(stockDelta).toBe(3);
    expect(changes).not.toHaveProperty('stock');
  });

  it('servicio → producto conserva el stock como valor absoluto', () => {
    const r = planInventoryEdit({ kind: 'service', stock: null }, { ...edit, stock: 4 });
    expect(r.changes.stock).toBe(4);
    expect(r.stockDelta).toBe(0);
  });
});
