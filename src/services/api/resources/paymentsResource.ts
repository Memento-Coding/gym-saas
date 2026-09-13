/**
 * paymentsResource — Handler REST para la clave 'payments' (/payments).
 *
 * Lectura: GET /payments (scan completo) → Payment[] del frontend.
 *
 * Escritura: el modelo de pagos de la API requiere `studentId`, extensión de
 * membresía y cálculo de recibo en el backend — datos que NO viajan en el
 * Payment plano que persiste PaymentService bajo la clave 'payments'. Por eso
 * la creación real de pagos en modo API debe hacerse con el endpoint dedicado
 * (ver createApiPayment más abajo), no por diff de la colección.
 *
 * Para no corromper datos, set() aquí es un no-op de reconciliación: sólo
 * persiste optimistamente en memoria de lectura los pagos nuevos que ya traigan
 * receiptNo (creados por el backend). Los nuevos pagos se envían con
 * createApiPayment(), que sí incluye el studentId y devuelve el pago del backend.
 *
 * @see gym-sass-infra/docs/API.md — Payments Lambda
 */

import { api } from '../apiClient';
import type { ResourceHandler } from './types';
import type { Payment } from '@/types/payment';
import { apiToPayment, paymentToApi, type ApiPayment } from '../mappers/paymentMapper';

/**
 * Crea un pago real contra la API, incluyendo el studentId (no presente en el
 * modelo Payment plano). Devuelve el pago mapeado a la forma del frontend.
 *
 * Debe usarse desde la capa de pagos cuando isApiMode() es true, en lugar de
 * confiar en el diff de la colección 'payments'.
 */
export async function createApiPayment(
  payment: Payment,
  studentId: string,
): Promise<Payment> {
  const created = await api.post<ApiPayment>('/payments', paymentToApi(payment, studentId));
  return apiToPayment(created);
}

export class PaymentsResource implements ResourceHandler {
  async get<T>(): Promise<T | null> {
    const payments = await api.get<ApiPayment[]>('/payments');
    const list = Array.isArray(payments) ? payments : [];
    return list.map((p) => apiToPayment(p)) as T;
  }

  async set<T>(_value: T): Promise<void> {
    // Intencionalmente no hace diff-sync: la creación de pagos requiere studentId
    // y se realiza vía createApiPayment(). Reconciliación silenciosa.
    void _value;
  }

  async remove(): Promise<void> {
    // La API no expone borrado masivo de pagos; no-op.
  }
}
