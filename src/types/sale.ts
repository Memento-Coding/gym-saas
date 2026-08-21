/**
 * Tipos para el módulo de ventas.
 * Define ventas de contado y crédito con planes de cuotas.
 */

import type { PaymentMethod } from './payment';

export interface SaleItem {
  inventoryId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface CreditInstallment {
  number: number;
  dueDate: string;
  amount: number;
  paid: boolean;
  paidDate?: string;
  paidAmount?: number;
}

export interface CreditPlan {
  type: 'single' | 'three_installments';
  installments: CreditInstallment[];
}

export interface Sale {
  id: string;
  date: string;
  clientType: 'student' | 'external';
  clientId?: string;
  clientName: string;
  items: SaleItem[];
  total: number;
  type: 'cash' | 'credit';
  method?: PaymentMethod;
  receiptNo: string;
  creditPlan?: CreditPlan;
}
