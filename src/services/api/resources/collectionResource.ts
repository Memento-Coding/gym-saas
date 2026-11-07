/**
 * collectionResource — Base reutilizable para recursos REST tipo colección.
 *
 * Muchos servicios del frontend persisten un array completo bajo una clave
 * (inventory_items, finance_movements, sales, payments...). Este helper
 * implementa el patrón común:
 *   get()        → GET  <listPath>            → mapea cada item a la forma front
 *   set(array)   → diff contra el remoto por id → POST/PUT/DELETE
 *
 * Las subclases sólo definen: rutas, mapeo apiToFront/frontToApi, la clave `id`
 * y (opcionalmente) qué campos disparan un PUT y si soportan update/delete.
 *
 * Si el recurso no soporta update o delete en la API (p. ej. finance sólo crea),
 * las subclases pueden sobreescribir updateItem/deleteItem como no-ops.
 */

import { api } from '../apiClient';
import type { ResourceHandler } from './types';

export interface CollectionConfig<Front, ApiShape> {
  /** Path de listado y creación (p. ej. '/inventory'). */
  listPath: string;
  /** Construye el path de un item (p. ej. id => `/inventory/${id}`). */
  itemPath: (id: string) => string;
  /** Mapea un item de la API al modelo del frontend. */
  apiToFront: (apiItem: ApiShape) => Front;
  /** Mapea un item del frontend al payload de la API. */
  frontToApi: (item: Front) => Record<string, unknown>;
  /** Extrae el id de un item del frontend. */
  idOf: (item: Front) => string;
  /** true si el item cambió respecto al remoto (para decidir PUT). */
  hasChanges?: (next: Front, prev: Front) => boolean;
  /** Habilita PUT en actualizaciones. Default: true. */
  canUpdate?: boolean;
  /** Habilita DELETE en eliminaciones. Default: true. */
  canDelete?: boolean;
}

export class CollectionResource<Front, ApiShape extends { id: string }>
  implements ResourceHandler
{
  protected cfg: Required<
    Pick<CollectionConfig<Front, ApiShape>, 'canUpdate' | 'canDelete'>
  > &
    CollectionConfig<Front, ApiShape>;

  constructor(config: CollectionConfig<Front, ApiShape>) {
    this.cfg = {
      canUpdate: true,
      canDelete: true,
      ...config,
    };
  }

  async get<T>(): Promise<T | null> {
    const items = await api.get<ApiShape[]>(this.cfg.listPath);
    const list = Array.isArray(items) ? items : [];
    return list.map((i) => this.cfg.apiToFront(i)) as T;
  }

  async set<T>(value: T): Promise<void> {
    const desired = (Array.isArray(value) ? value : []) as Front[];

    const remote = await api.get<ApiShape[]>(this.cfg.listPath);
    const remoteList = Array.isArray(remote) ? remote : [];
    const remoteFront = remoteList.map((i) => this.cfg.apiToFront(i));
    const remoteById = new Map(remoteFront.map((i) => [this.cfg.idOf(i), i]));
    const desiredIds = new Set(desired.map((i) => this.cfg.idOf(i)));

    for (const item of desired) {
      const id = this.cfg.idOf(item);
      const prev = remoteById.get(id);
      if (!prev) {
        await api.post(this.cfg.listPath, this.cfg.frontToApi(item));
      } else if (this.cfg.canUpdate && this.changed(item, prev)) {
        await api.put(this.cfg.itemPath(id), this.cfg.frontToApi(item));
      }
    }

    if (this.cfg.canDelete) {
      for (const item of remoteFront) {
        const id = this.cfg.idOf(item);
        if (!desiredIds.has(id)) {
          await api.delete(this.cfg.itemPath(id));
        }
      }
    }
  }

  async remove(): Promise<void> {
    if (!this.cfg.canDelete) return;
    const remote = await api.get<ApiShape[]>(this.cfg.listPath);
    const remoteList = Array.isArray(remote) ? remote : [];
    for (const item of remoteList) {
      await api.delete(this.cfg.itemPath(item.id));
    }
  }

  private changed(next: Front, prev: Front): boolean {
    if (this.cfg.hasChanges) return this.cfg.hasChanges(next, prev);
    return JSON.stringify(this.cfg.frontToApi(next)) !== JSON.stringify(this.cfg.frontToApi(prev));
  }
}
