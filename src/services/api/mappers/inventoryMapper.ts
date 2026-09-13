/**
 * inventoryMapper — Traducción entre InventoryItem (frontend) y el ítem de la API.
 *
 * Frontend usa `kind: 'product' | 'service'` y `stock: number | null`.
 * La API (inventory Lambda) usa `type: 'product' | 'service'` y expone stock,
 * cost, price, minStock, category.
 *
 * @see gym-sass-infra/docs/API.md — (inventory vía sales Lambda)
 * @see gym-sass-infra/docs/DATA-MODEL.md — inventory (GSI_Type)
 */

import type { InventoryItem } from '@/types/inventory';

export interface ApiInventoryItem {
  id: string;
  type?: 'product' | 'service';
  name?: string;
  cost?: number;
  price?: number;
  stock?: number | null;
  [key: string]: unknown;
}

export function apiToInventory(api: ApiInventoryItem): InventoryItem {
  const kind = api.type === 'service' ? 'service' : 'product';
  return {
    id: api.id,
    kind,
    name: api.name ?? '',
    cost: api.cost ?? 0,
    price: api.price ?? 0,
    stock: kind === 'service' ? null : api.stock ?? 0,
  };
}

export function inventoryToApi(item: InventoryItem): Record<string, unknown> {
  return {
    id: item.id,
    type: item.kind,
    name: item.name,
    cost: item.cost,
    price: item.price,
    stock: item.kind === 'service' ? null : item.stock,
  };
}
