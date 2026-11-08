/**
 * inventoryResource — Handler REST para la clave 'inventory_items' (/inventory).
 *
 * @see gym-sass-infra/docs/DATA-MODEL.md — inventory
 */

import { api } from '../apiClient';
import { CollectionResource } from './collectionResource';
import type { InventoryItem } from '@/types/inventory';
import {
  apiToInventory,
  inventoryToApi,
  type ApiInventoryItem,
} from '../mappers/inventoryMapper';

export class InventoryResource extends CollectionResource<InventoryItem, ApiInventoryItem> {
  constructor() {
    super({
      listPath: '/inventory',
      itemPath: (id) => `/inventory/${encodeURIComponent(id)}`,
      apiToFront: apiToInventory,
      frontToApi: inventoryToApi,
      idOf: (item) => item.id,
      hasChanges: (next, prev) =>
        next.name !== prev.name ||
        next.cost !== prev.cost ||
        next.price !== prev.price ||
        next.kind !== prev.kind,
    });
  }

  /** El PUT ignora `stock`: cada diferencia se aplica como movimiento atómico. */
  async set<T>(value: T): Promise<void> {
    await super.set(value);

    const remote = await api.get<ApiInventoryItem[]>('/inventory');
    const remoteById = new Map((remote ?? []).map((i) => [i.id, apiToInventory(i)]));

    for (const item of value as InventoryItem[]) {
      const current = remoteById.get(item.id);
      if (!current || current.stock === null || item.stock === null) continue;
      const delta = item.stock - current.stock;
      if (delta !== 0) {
        await api.post(`/inventory/${encodeURIComponent(item.id)}/stock`, {
          operation: delta > 0 ? 'increment' : 'decrement',
          quantity: Math.abs(delta),
          reason: 'Ajuste desde inventario',
        });
      }
    }
  }
}
