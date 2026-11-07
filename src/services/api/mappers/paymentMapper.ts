/**
 * paymentMapper — Traducción entre Payment (frontend) y el pago de la API.
 *
 * Frontend Payment: id, date, amount (bruto), method, splits, status
 * ('paid'|'upgrade'|'credit'), planName, category, discount, discountReason,
 * receiptNo.
 *
 * API payment (payments Lambda): usa studentId, concept, plan, grossAmount,
 * discount { type, value, reason }, paymentType ('full'|'split'|'credit'),
 * splits [{method, amount}], credit {...}, receiptNo (GOP-XXXX), createdAt.
 *
 * @see gym-sass-infra/docs/API.md — Payments Lambda
 */

import type { Payment, PaymentMethod, PaymentSplit } from '@/types/payment';

export interface ApiPayment {
  id?: string;
  studentId?: string;
  receiptNo?: string;
  concept?: string;
  plan?: string;
  grossAmount?: number;
  netAmount?: number;
  discount?: number | { type?: string; value?: number; reason?: string };
  paymentType?: 'full' | 'split' | 'credit';
  method?: string;
  splits?: { method?: string; amount?: number }[];
  category?: string;
  createdAt?: string;
  date?: string;
  [key: string]: unknown;
}

function toMethod(value: string | undefined): PaymentMethod {
  if (value === 'Nequi' || value === 'Banco') return value;
  return 'Efectivo';
}

function toStatus(paymentType: string | undefined): Payment['status'] {
  if (paymentType === 'credit') return 'credit';
  return 'paid';
}

function extractDiscount(discount: ApiPayment['discount']): {
  amount: number;
  reason: string;
} {
  if (typeof discount === 'number') {
    return { amount: discount, reason: '' };
  }
  if (discount && typeof discount === 'object') {
    return { amount: discount.value ?? 0, reason: discount.reason ?? '' };
  }
  return { amount: 0, reason: '' };
}

export function apiToPayment(api: ApiPayment): Payment {
  const { amount: discountAmount, reason } = extractDiscount(api.discount);
  const splits: PaymentSplit[] | undefined = api.splits?.map((s) => ({
    method: toMethod(s.method),
    amount: s.amount ?? 0,
  }));

  return {
    id: api.id ?? api.receiptNo ?? crypto.randomUUID(),
    date: api.date ?? (api.createdAt ? api.createdAt.slice(0, 10) : ''),
    amount: api.grossAmount ?? 0,
    method: toMethod(api.method),
    splits: splits && splits.length > 0 ? splits : undefined,
    status: toStatus(api.paymentType),
    planName: api.plan ?? '',
    category: api.category === 'personalizada' ? 'personalizada' : 'mensualidad',
    discount: discountAmount,
    discountReason: reason,
    receiptNo: api.receiptNo,
  };
}

/**
 * Convierte un Payment del frontend al payload de creación de la API.
 * Requiere el studentId, que no está en Payment (vive en el estudiante); el
 * recurso lo inyecta desde el contexto de escritura.
 */
export function paymentToApi(payment: Payment, studentId: string): Record<string, unknown> {
  const paymentType =
    payment.status === 'credit'
      ? 'credit'
      : payment.splits && payment.splits.length > 0
        ? 'split'
        : 'full';

  const body: Record<string, unknown> = {
    studentId,
    concept: 'membership',
    plan: payment.planName,
    grossAmount: payment.amount,
    paymentType,
    method: payment.method,
    category: payment.category,
  };

  if (payment.discount > 0) {
    body.discount = {
      type: 'amount',
      value: payment.discount,
      reason: payment.discountReason,
    };
  }

  if (paymentType === 'split' && payment.splits) {
    body.splits = payment.splits.map((s) => ({ method: s.method, amount: s.amount }));
  }

  return body;
}
