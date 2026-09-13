/**
 * saleMapper — Traducción entre Sale (frontend) y la venta de la API.
 *
 * Frontend Sale: id, date, clientType, clientId, clientName, items[
 *   {inventoryId,name,quantity,unitPrice,subtotal} ], total, type ('cash'|'credit'),
 *   method, receiptNo, creditPlan { type, installments[] }.
 *
 * API sale (sales Lambda): customerId, customerName, method, paymentType
 * ('cash'|'credit'), items[ {productId,name,quantity,price,type} ], creditPlan
 * { totalAmount, initialDown, installments[ {number,amount,dueDate,status} ] },
 * receiptNo, createdAt.
 *
 * @see gym-sass-infra/docs/API.md — Sales Lambda
 */

import type { Sale, SaleItem, CreditInstallment, CreditPlan } from '@/types/sale';
import type { PaymentMethod } from '@/types/payment';

export interface ApiSaleItem {
  productId?: string;
  name?: string;
  quantity?: number;
  price?: number;
  type?: 'product' | 'service';
}

export interface ApiInstallment {
  number?: number;
  amount?: number;
  dueDate?: string;
  status?: string;
  paidDate?: string;
  paidAmount?: number;
}

export interface ApiSale {
  id: string;
  customerId?: string;
  customerName?: string;
  method?: string;
  paymentType?: 'cash' | 'credit';
  items?: ApiSaleItem[];
  total?: number;
  receiptNo?: string;
  createdAt?: string;
  date?: string;
  creditPlan?: {
    totalAmount?: number;
    initialDown?: number;
    installments?: ApiInstallment[];
  };
  [key: string]: unknown;
}

function toMethod(value: string | undefined): PaymentMethod | undefined {
  if (value === 'Nequi' || value === 'Banco' || value === 'Efectivo') return value;
  return undefined;
}

function apiToInstallment(i: ApiInstallment): CreditInstallment {
  return {
    number: i.number ?? 0,
    dueDate: i.dueDate ?? '',
    amount: i.amount ?? 0,
    paid: i.status === 'paid',
    paidDate: i.paidDate,
    paidAmount: i.paidAmount,
  };
}

export function apiToSale(api: ApiSale): Sale {
  const items: SaleItem[] = (api.items ?? []).map((it) => ({
    inventoryId: it.productId ?? '',
    name: it.name ?? '',
    quantity: it.quantity ?? 0,
    unitPrice: it.price ?? 0,
    subtotal: (it.quantity ?? 0) * (it.price ?? 0),
  }));

  const creditPlan: CreditPlan | undefined = api.creditPlan
    ? {
        type:
          (api.creditPlan.installments?.length ?? 0) > 1
            ? 'three_installments'
            : 'single',
        installments: (api.creditPlan.installments ?? []).map(apiToInstallment),
      }
    : undefined;

  return {
    id: api.id,
    date: api.date ?? (api.createdAt ? api.createdAt.slice(0, 10) : ''),
    clientType: api.customerId ? 'student' : 'external',
    clientId: api.customerId,
    clientName: api.customerName ?? '',
    items,
    total: api.total ?? items.reduce((acc, i) => acc + i.subtotal, 0),
    type: api.paymentType === 'credit' ? 'credit' : 'cash',
    method: toMethod(api.method),
    receiptNo: api.receiptNo ?? '',
    creditPlan,
  };
}

export function saleToApi(sale: Sale): Record<string, unknown> {
  const body: Record<string, unknown> = {
    customerId: sale.clientId,
    customerName: sale.clientName,
    method: sale.method,
    paymentType: sale.type,
    items: sale.items.map((it) => ({
      productId: it.inventoryId,
      name: it.name,
      quantity: it.quantity,
      price: it.unitPrice,
      type: 'product',
    })),
  };

  if (sale.type === 'credit' && sale.creditPlan) {
    const installments = sale.creditPlan.installments;
    const initialDown =
      sale.total - installments.reduce((acc, i) => acc + i.amount, 0);
    body.creditPlan = {
      totalAmount: sale.total,
      initialDown: initialDown > 0 ? initialDown : 0,
      installments: installments.map((i) => ({
        number: i.number,
        amount: i.amount,
        dueDate: i.dueDate,
        status: i.paid ? 'paid' : 'pending',
      })),
    };
  }

  return body;
}
