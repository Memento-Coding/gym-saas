/**
 * InventoryService — Gestión de inventario y control de stock (Track C).
 *
 * Responsabilidades:
 * - CRUD de ítems de inventario, diferenciando Productos (con stock físico)
 *   de Servicios (sin stock: stock === null).
 * - Descuento automático de stock al registrar una venta.
 * - Rechazo controlado de ventas cuando el stock disponible es insuficiente.
 * - Incremento de stock por reabastecimiento (entradas/egresos de compra).
 *
 * Persistencia: delega en el StorageService unificado (inyectable). Todos los
 * ítems se almacenan bajo una única clave como un array.
 *
 * Manejo de errores: las operaciones que pueden fallar por reglas de negocio
 * retornan un ServiceResult discriminado, forzando su manejo explícito.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import type { StorageService } from '@/services/storage/StorageService';
import type { InventoryItem } from '@/types/inventory';
import type { SaleItem } from '@/types/sale';

/** Clave de almacenamiento de la colección de inventario. */
const INVENTORY_KEY = 'inventory_items';

/**
 * Resultado discriminado para operaciones que pueden fallar por reglas de
 * negocio. Consistente con StudentService/PaymentService.
 */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Datos para crear un ítem de inventario (id se genera). */
export interface CreateInventoryItemInput {
  kind: 'product' | 'service';
  name: string;
  cost: number;
  price: number;
  /**
   * Stock inicial. Obligatorio y >= 0 para productos; se ignora (se fuerza a
   * null) para servicios.
   */
  stock?: number | null;
}

/** Genera un id único con fallback determinista si crypto no está disponible. */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export class InventoryService {
  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  // ---------------------------------------------------------------------------
  // Persistencia interna
  // ---------------------------------------------------------------------------

  /** Lee la colección completa de ítems. */
  private async read(): Promise<InventoryItem[]> {
    const items = await this.storageService.get<InventoryItem[]>(INVENTORY_KEY);
    return items ?? [];
  }

  /** Persiste la colección completa de ítems. */
  private async write(items: InventoryItem[]): Promise<void> {
    await this.storageService.set<InventoryItem[]>(INVENTORY_KEY, items);
  }

  // ---------------------------------------------------------------------------
  // CRUD (Req 8.1)
  // ---------------------------------------------------------------------------

  /** Retorna todos los ítems de inventario. */
  async getAll(): Promise<InventoryItem[]> {
    return this.read();
  }

  /** Retorna un ítem por su id, o null si no existe. */
  async getById(id: string): Promise<InventoryItem | null> {
    const items = await this.read();
    return items.find((i) => i.id === id) ?? null;
  }

  /** Retorna solo los productos (kind === 'product'). */
  async getProducts(): Promise<InventoryItem[]> {
    const items = await this.read();
    return items.filter((i) => i.kind === 'product');
  }

  /** Retorna solo los servicios (kind === 'service'). */
  async getServices(): Promise<InventoryItem[]> {
    const items = await this.read();
    return items.filter((i) => i.kind === 'service');
  }

  /**
   * Crea un ítem de inventario.
   *
   * Reglas (Req 8.1):
   *  - Productos: `stock` es obligatorio, numérico, entero y >= 0.
   *  - Servicios: `stock` siempre se persiste como null (no manejan stock).
   *  - `name` no puede estar vacío; `cost` y `price` no pueden ser negativos.
   */
  async create(input: CreateInventoryItemInput): Promise<ServiceResult<InventoryItem>> {
    const name = input.name?.trim() ?? '';
    if (name === '') {
      return { success: false, error: 'El nombre del ítem es obligatorio.' };
    }
    if (!Number.isFinite(input.cost) || input.cost < 0) {
      return { success: false, error: 'El costo no puede ser negativo.' };
    }
    if (!Number.isFinite(input.price) || input.price < 0) {
      return { success: false, error: 'El precio no puede ser negativo.' };
    }

    let stock: number | null;
    if (input.kind === 'product') {
      const raw = input.stock;
      if (raw === null || raw === undefined || !Number.isFinite(raw)) {
        return { success: false, error: 'Un producto requiere un stock inicial válido.' };
      }
      if (!Number.isInteger(raw) || raw < 0) {
        return { success: false, error: 'El stock inicial debe ser un entero mayor o igual a 0.' };
      }
      stock = raw;
    } else {
      // Servicio: nunca maneja stock.
      stock = null;
    }

    const item: InventoryItem = {
      id: generateId(),
      kind: input.kind,
      name,
      cost: input.cost,
      price: input.price,
      stock,
    };

    const items = await this.read();
    items.push(item);
    await this.write(items);

    return { success: true, data: item };
  }

  /**
   * Actualiza un ítem existente por id. No permite cambiar el `id`.
   *
   * Si el ítem es un servicio, el `stock` se mantiene en null aunque se intente
   * fijar. Para productos, un `stock` provisto debe ser entero >= 0.
   */
  async update(
    id: string,
    changes: Partial<Omit<InventoryItem, 'id'>>,
  ): Promise<ServiceResult<InventoryItem>> {
    const items = await this.read();
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) {
      return { success: false, error: 'Ítem de inventario no encontrado.' };
    }

    const current = items[index];
    const merged: InventoryItem = { ...current, ...changes, id: current.id };

    // Validaciones de campos numéricos si fueron provistos.
    if (changes.cost !== undefined && (!Number.isFinite(merged.cost) || merged.cost < 0)) {
      return { success: false, error: 'El costo no puede ser negativo.' };
    }
    if (changes.price !== undefined && (!Number.isFinite(merged.price) || merged.price < 0)) {
      return { success: false, error: 'El precio no puede ser negativo.' };
    }
    if (typeof merged.name === 'string' && merged.name.trim() === '') {
      return { success: false, error: 'El nombre del ítem es obligatorio.' };
    }

    // Coherencia de stock según kind.
    if (merged.kind === 'service') {
      merged.stock = null;
    } else {
      // Producto: si se intentó fijar stock, validar; si quedó null, error.
      if (merged.stock === null || merged.stock === undefined) {
        return { success: false, error: 'Un producto requiere un stock válido.' };
      }
      if (!Number.isInteger(merged.stock) || merged.stock < 0) {
        return { success: false, error: 'El stock debe ser un entero mayor o igual a 0.' };
      }
    }

    items[index] = merged;
    await this.write(items);
    return { success: true, data: merged };
  }

  /** Elimina un ítem por id. */
  async delete(id: string): Promise<ServiceResult<string>> {
    const items = await this.read();
    const next = items.filter((i) => i.id !== id);
    if (next.length === items.length) {
      return { success: false, error: 'Ítem de inventario no encontrado.' };
    }
    await this.write(next);
    return { success: true, data: id };
  }

  // ---------------------------------------------------------------------------
  // Control de stock
  // ---------------------------------------------------------------------------

  /**
   * Verifica si hay stock suficiente para vender `quantity` unidades de un ítem.
   * Los servicios (stock === null) siempre tienen disponibilidad.
   *
   * @returns true si se puede vender esa cantidad; false si no.
   */
  async hasStock(itemId: string, quantity: number): Promise<boolean> {
    const item = await this.getById(itemId);
    if (!item) return false;
    if (item.kind === 'service' || item.stock === null) return true;
    return quantity >= 0 && item.stock >= quantity;
  }

  /**
   * Descuenta stock al registrar una venta (Req 8.2 y 8.3).
   *
   * - Valida TODAS las líneas antes de aplicar cambios (operación atómica):
   *   si alguna línea de producto excede el stock disponible, se rechaza la
   *   venta completa sin modificar nada.
   * - Los ítems de tipo servicio (stock === null) no descuentan stock.
   * - Cantidades <= 0 se consideran inválidas.
   *
   * @param saleItems Líneas de la venta (usan inventoryId + quantity).
   * @returns ServiceResult con los ítems actualizados, o error de negocio.
   */
  async applySale(saleItems: SaleItem[]): Promise<ServiceResult<InventoryItem[]>> {
    if (!saleItems || saleItems.length === 0) {
      return { success: false, error: 'La venta no contiene ítems.' };
    }

    const items = await this.read();
    const byId = new Map(items.map((i) => [i.id, i]));

    // Agregar cantidades por ítem (una venta puede repetir el mismo producto).
    const requested = new Map<string, number>();
    for (const line of saleItems) {
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        return {
          success: false,
          error: `Cantidad inválida para el ítem "${line.name}".`,
        };
      }
      const item = byId.get(line.inventoryId);
      if (!item) {
        return {
          success: false,
          error: `Ítem de inventario no encontrado: ${line.inventoryId}.`,
        };
      }
      requested.set(
        line.inventoryId,
        (requested.get(line.inventoryId) ?? 0) + line.quantity,
      );
    }

    // Fase de validación: rechazar si algún producto no tiene stock suficiente.
    for (const [itemId, qty] of requested) {
      const item = byId.get(itemId)!;
      if (item.kind === 'product' && item.stock !== null && item.stock < qty) {
        return {
          success: false,
          error: `Stock insuficiente para "${item.name}": disponible ${item.stock}, solicitado ${qty}.`,
        };
      }
    }

    // Fase de aplicación: descontar stock (solo productos con stock numérico).
    const updated = items.map((item) => {
      const qty = requested.get(item.id);
      if (qty && item.kind === 'product' && item.stock !== null) {
        return { ...item, stock: item.stock - qty };
      }
      return item;
    });

    await this.write(updated);
    return { success: true, data: updated };
  }

  /**
   * Incrementa el stock de un producto por reabastecimiento (Req 8.4).
   *
   * - Solo aplica a productos; los servicios no manejan stock y se rechazan.
   * - La cantidad debe ser un entero positivo.
   *
   * @param itemId Id del producto a reabastecer.
   * @param quantity Unidades a agregar (entero > 0).
   * @returns ServiceResult con el producto actualizado.
   */
  async restock(itemId: string, quantity: number): Promise<ServiceResult<InventoryItem>> {
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      return { success: false, error: 'La cantidad a reabastecer debe ser un entero positivo.' };
    }

    const items = await this.read();
    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) {
      return { success: false, error: 'Ítem de inventario no encontrado.' };
    }

    const item = items[index];
    if (item.kind === 'service' || item.stock === null) {
      return { success: false, error: 'Los servicios no manejan stock; no se pueden reabastecer.' };
    }

    const updated: InventoryItem = { ...item, stock: item.stock + quantity };
    items[index] = updated;
    await this.write(items);
    return { success: true, data: updated };
  }

  /**
   * Ajusta el stock a un valor absoluto (útil para correcciones de inventario).
   * Solo productos; el valor debe ser entero >= 0.
   */
  async setStock(itemId: string, stock: number): Promise<ServiceResult<InventoryItem>> {
    if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < 0) {
      return { success: false, error: 'El stock debe ser un entero mayor o igual a 0.' };
    }

    const items = await this.read();
    const index = items.findIndex((i) => i.id === itemId);
    if (index === -1) {
      return { success: false, error: 'Ítem de inventario no encontrado.' };
    }

    const item = items[index];
    if (item.kind === 'service' || item.stock === null) {
      return { success: false, error: 'Los servicios no manejan stock.' };
    }

    const updated: InventoryItem = { ...item, stock };
    items[index] = updated;
    await this.write(items);
    return { success: true, data: updated };
  }
}
