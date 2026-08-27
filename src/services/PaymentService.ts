/**
 * PaymentService — Módulo de pagos (Track B).
 *
 * Registra pagos de mensualidad vinculados a estudiantes, calcula la extensión
 * de la fecha de vencimiento, valida pagos divididos (splits), genera números
 * de comprobante secuenciales `GOP-XXXX` y soporta pagos a crédito.
 *
 * Usa el StorageService de la Fase 0 (inyectable; por defecto el singleton).
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { getStorageService, type StorageService } from '@/services/storage/StorageService';
import type { Payment, PaymentMethod, PaymentSplit } from '@/types/payment';
import type { MembershipPlan } from '@/types/membership';
import type { AppMeta } from '@/types/settings';
import type { CreditPlan } from '@/types/sale';

/** Clave de storage para el metadato de secuencia de comprobantes. */
const META_KEY = 'meta';
/** Clave de storage para el historial de pagos. */
const PAYMENTS_KEY = 'payments';
/** Cantidad mínima de dígitos del número de comprobante GOP-XXXX. */
const RECEIPT_PAD = 4;

/** Resultado discriminado consistente para todas las operaciones. */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Payload para registrar un pago. `amount` es el monto bruto; `discount`
 * (opcional) se resta para obtener el neto que debe cuadrar con los splits.
 */
export interface PaymentInput {
  studentId: string;
  date: string; // ISO YYYY-MM-DD
  amount: number;
  method: PaymentMethod;
  splits?: PaymentSplit[];
  status: 'paid' | 'upgrade' | 'credit';
  planName: string;
  category: 'mensualidad' | 'personalizada';
  discount?: number;
  discountReason?: string;
  /** Plan de cuotas para pagos a crédito (status 'credit'). */
  creditPlan?: CreditPlan;
  /** Abono inicial para pagos a crédito. */
  initialPayment?: number;
}

/** Resultado del registro de un pago. */
export interface RegisterPaymentResult {
  payment: Payment;
  receiptNo: string;
  /** Nueva fecha de vencimiento calculada (si aplica extensión). */
  newSubscriptionEndDate?: string;
}

// =============================================================================
// Helpers de fecha (parseo seguro de ISO YYYY-MM-DD en UTC)
// =============================================================================

/** Parsea un ISO `YYYY-MM-DD` a un Date en UTC (medianoche). */
function parseIsoDate(iso: string): Date {
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Formatea un Date a ISO `YYYY-MM-DD` usando componentes UTC. */
function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Suma un mes calendario a una fecha, con clamping del día al último día del
 * mes destino (ej. 31 ene + 1 mes → 28/29 feb). Trabaja en UTC.
 */
function addOneMonth(date: Date): Date {
  const day = date.getUTCDate();
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  // Último día del mes destino.
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

// =============================================================================
// Lógica pura (exportada para tests y reutilización)
// =============================================================================

/**
 * Calcula la nueva fecha de vencimiento tras un pago.
 *
 * - status 'paid' y plan NO single → `max(oldEnd, paymentDate) + 1 mes`.
 * - status 'upgrade' o plan single → sin cambio (retorna oldEnd).
 *
 * Requirements: 5.1, 5.2, 4.5
 */
export function computeSubscriptionEndDate(
  oldEndDate: string,
  paymentDate: string,
  status: 'paid' | 'upgrade' | 'credit',
  plan?: Pick<MembershipPlan, 'single'>,
): string {
  const isSingle = plan?.single === true;

  // Solo 'paid' con plan no-single extiende el vencimiento.
  if (status !== 'paid' || isSingle) {
    return oldEndDate;
  }

  const oldEnd = parseIsoDate(oldEndDate);
  const payDate = parseIsoDate(paymentDate);
  const base = oldEnd.getTime() >= payDate.getTime() ? oldEnd : payDate;
  return toIsoDate(addOneMonth(base));
}

/**
 * Calcula el monto neto de un pago (bruto menos descuento, nunca negativo).
 */
export function computeNetAmount(amount: number, discount = 0): number {
  return amount - discount;
}

/**
 * Valida que la suma de los splits iguale el monto neto (amount - discount).
 * Retorna un resultado discriminado. Si no hay splits, es válido (pago simple).
 *
 * Requirements: 5.6
 */
export function validateSplits(
  amount: number,
  splits: PaymentSplit[] | undefined,
  discount = 0,
): ServiceResult<number> {
  const net = computeNetAmount(amount, discount);

  if (!splits || splits.length === 0) {
    return { success: true, data: net };
  }

  const sum = splits.reduce((acc, s) => acc + s.amount, 0);

  if (sum !== net) {
    return {
      success: false,
      error: `La suma de los pagos divididos (${sum}) no coincide con el monto a pagar (${net}).`,
    };
  }

  return { success: true, data: net };
}

/** Formatea un número de secuencia como comprobante `GOP-XXXX`. */
export function formatReceiptNo(seq: number): string {
  return `GOP-${String(seq).padStart(RECEIPT_PAD, '0')}`;
}

// =============================================================================
// Servicio
// =============================================================================

export class PaymentService {
  private storagePromise: Promise<StorageService>;

  constructor(storage?: StorageService) {
    this.storagePromise = storage ? Promise.resolve(storage) : getStorageService();
  }

  private async storage(): Promise<StorageService> {
    return this.storagePromise;
  }

  /**
   * Genera el siguiente número de comprobante `GOP-XXXX`, leyendo e
   * incrementando el `seq` del AppMeta persistido.
   *
   * Requirements: 5.5, 2.7
   */
  async generateReceiptNo(): Promise<string> {
    const storage = await this.storage();
    const meta = (await storage.get<AppMeta>(META_KEY)) ?? { seq: 1 };
    const receiptNo = formatReceiptNo(meta.seq);
    await storage.set<AppMeta>(META_KEY, { ...meta, seq: meta.seq + 1 });
    return receiptNo;
  }

  /**
   * Registra un pago: valida splits, genera comprobante y persiste el pago.
   * Retorna el pago creado, el número de comprobante y (si aplica) la nueva
   * fecha de vencimiento calculada.
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
   */
  async registerPayment(
    input: PaymentInput,
    context?: {
      /** Fecha de vencimiento actual del estudiante, para calcular la extensión. */
      currentSubscriptionEndDate?: string;
      /** Plan asociado, para detectar `single`. */
      plan?: Pick<MembershipPlan, 'single'>;
    },
  ): Promise<ServiceResult<RegisterPaymentResult>> {
    const discount = input.discount ?? 0;

    // Validación básica de montos.
    if (input.amount < 0 || discount < 0) {
      return { success: false, error: 'El monto y el descuento no pueden ser negativos.' };
    }

    // Validación de splits (Req 5.6).
    const splitCheck = validateSplits(input.amount, input.splits, discount);
    if (!splitCheck.success) {
      return { success: false, error: splitCheck.error };
    }

    // Número de comprobante (Req 5.5).
    const receiptNo = await this.generateReceiptNo();

    const payment: Payment = {
      id: crypto.randomUUID(),
      date: input.date,
      amount: input.amount,
      method: input.method,
      splits: input.splits,
      status: input.status,
      planName: input.planName,
      category: input.category,
      discount,
      discountReason: input.discountReason ?? '',
      receiptNo,
    };

    // Cálculo de extensión de vencimiento (Req 5.1, 5.2).
    let newSubscriptionEndDate: string | undefined;
    if (context?.currentSubscriptionEndDate) {
      newSubscriptionEndDate = computeSubscriptionEndDate(
        context.currentSubscriptionEndDate,
        input.date,
        input.status,
        context.plan,
      );
    }

    // Persistencia del pago.
    const storage = await this.storage();
    const payments = (await storage.get<Payment[]>(PAYMENTS_KEY)) ?? [];
    payments.push(payment);
    await storage.set<Payment[]>(PAYMENTS_KEY, payments);

    return {
      success: true,
      data: { payment, receiptNo, newSubscriptionEndDate },
    };
  }

  /** Retorna todos los pagos persistidos. */
  async getAll(): Promise<Payment[]> {
    const storage = await this.storage();
    return (await storage.get<Payment[]>(PAYMENTS_KEY)) ?? [];
  }
}

/** Instancia singleton por conveniencia (usa el StorageService singleton). */
export const paymentService = new PaymentService();
