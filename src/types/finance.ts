/**
 * Tipos para el módulo de finanzas.
 * Define la estructura de movimientos financieros.
 */

import type { PaymentMethod } from './payment';

export interface FinanceMovement {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  concept: string;
  category: string;
  amount: number;
  box: 'servicios' | 'almacen';
  method?: PaymentMethod;
  studentId?: string;
  transferTo?: string;
  inventoryItemId?: string;
}
