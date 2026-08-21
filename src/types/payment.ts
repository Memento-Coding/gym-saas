/**
 * Tipos para el módulo de pagos.
 * Define las estructuras de pagos, métodos y splits.
 */

export type PaymentMethod = 'Efectivo' | 'Nequi' | 'Banco';

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  splits?: PaymentSplit[];
  status: 'paid' | 'upgrade' | 'credit';
  planName: string;
  category: 'mensualidad' | 'personalizada';
  discount: number;
  discountReason: string;
  receiptNo?: string;
}
