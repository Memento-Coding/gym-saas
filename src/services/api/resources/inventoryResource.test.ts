import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InventoryItem } from '@/types/inventory';

const { get, post, put } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../apiClient', () => ({ api: { get, post, put, delete: vi.fn() } }));

import { InventoryResource } from './inventoryResource';

const item = (stock: number | null, name = 'Guantes'): InventoryItem => ({
  id: 'a', kind: stock === null ? 'service' : 'product', name, cost: 10, price: 20, stock,
});
const remote = (stock: number | null) => [{
  id: 'a', type: stock === null ? 'service' : 'product', name: 'Guantes', cost: 10, price: 20, stock,
}];

describe('InventoryResource.set', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue(remote(5));
    post.mockReset().mockResolvedValue({});
    put.mockReset().mockResolvedValue({});
  });

  it('subir el stock envía un increment por la diferencia, sin PUT', async () => {
    await new InventoryResource().set([item(8)]);
    expect(put).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/inventory/a/stock', expect.objectContaining({ operation: 'increment', quantity: 3 }));
  });

  it('bajar el stock envía un decrement', async () => {
    await new InventoryResource().set([item(2)]);
    expect(post).toHaveBeenCalledWith('/inventory/a/stock', expect.objectContaining({ operation: 'decrement', quantity: 3 }));
  });

  it('sin cambio de stock no hay movimiento, aunque cambie el nombre', async () => {
    await new InventoryResource().set([item(5, 'Vendas')]);
    expect(put).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it('un servicio nunca genera movimientos', async () => {
    get.mockResolvedValue(remote(null));
    await new InventoryResource().set([item(null)]);
    expect(post).not.toHaveBeenCalled();
  });

  it('un ítem nuevo se crea con su stock, sin movimiento adicional', async () => {
    get.mockResolvedValueOnce([]).mockResolvedValueOnce(remote(5));
    await new InventoryResource().set([item(5)]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/inventory', expect.objectContaining({ stock: 5 }));
  });
});
