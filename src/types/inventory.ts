/**
 * Tipos para el módulo de inventario.
 * Define la estructura de productos y servicios disponibles para venta.
 */

export interface InventoryItem {
  id: string;
  kind: 'product' | 'service';
  name: string;
  cost: number;
  price: number;
  stock: number | null;
}
