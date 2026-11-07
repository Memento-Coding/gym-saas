/**
 * financeMapper — Traducción entre FinanceMovement (frontend) y el movimiento API.
 *
 * Frontend: box: 'servicios' | 'almacen', type: 'income'|'expense'|'transfer'.
 * La API (finance Lambda) indexa por `type` (income/expense) y `account`
 * (cash/nequi/bank) según DATA-MODEL. Mapeamos `box` ⇄ `account` conservando el
 * valor original del frontend en un campo espejo para round-trip fiel.
 *
 * @see gym-sass-infra/docs/DATA-MODEL.md — finance (GSI_Type, GSI_Account)
 */

import type { FinanceMovement } from '@/types/finance';

export interface ApiFinanceMovement {
  id: string;
  type?: 'income' | 'expense' | 'transfer';
  date?: string;
  concept?: string;
  category?: string;
  amount?: number;
  account?: string;
  box?: string;
  method?: string;
  studentId?: string;
  transferTo?: string;
  inventoryItemId?: string;
  [key: string]: unknown;
}

function toBox(value: string | undefined): FinanceMovement['box'] {
  return value === 'almacen' ? 'almacen' : 'servicios';
}

export function apiToFinance(api: ApiFinanceMovement): FinanceMovement {
  return {
    id: api.id,
    type: api.type ?? 'income',
    date: api.date ?? '',
    concept: api.concept ?? '',
    category: api.category ?? '',
    amount: api.amount ?? 0,
    box: toBox(api.box ?? api.account),
    method: api.method as FinanceMovement['method'],
    studentId: api.studentId,
    transferTo: api.transferTo,
    inventoryItemId: api.inventoryItemId,
  };
}

export function financeToApi(m: FinanceMovement): Record<string, unknown> {
  return {
    id: m.id,
    type: m.type,
    date: m.date,
    concept: m.concept,
    category: m.category,
    amount: m.amount,
    // account es el nombre canónico en la API; box se envía como espejo.
    account: m.box,
    box: m.box,
    method: m.method,
    studentId: m.studentId,
    transferTo: m.transferTo,
    inventoryItemId: m.inventoryItemId,
  };
}
