/**
 * inventoryResource — Handler REST para la clave 'inventory_items' (/inventory).
 *
 * @see gym-sass-infra/docs/DATA-MODEL.md — inventory
 */

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
        next.stock !== prev.stock ||
        next.kind !== prev.kind,
    });
  }
}
