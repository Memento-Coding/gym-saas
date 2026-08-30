/**
 * SaleService — Módulo de ventas de contado y a crédito (Track C).
 *
 * Responsabilidades:
 * - Registrar ventas con múltiples líneas (Req 9.1, 9.2). El total es la suma
 *   estricta de (quantity * unitPrice) por línea.
 * - Ventas a crédito (Req 9.3, 9.4, 9.5): rechaza si el carrito incluye
 *   servicios; genera plan de cuotas (única con fecha custom, o 3 cuotas cada
 *   15 días repartiendo Total - Abono inicial sin pérdida por redondeo).
 * - Recálculo de cuotas al pagar (Req 9.6): si el monto pagado difiere del
 *   original, reparte equitativamente el saldo sobre las cuotas no pagadas.
 * - Número de comprobante secuencial GOP-XXXX (Req 9.7) usando la clave `meta`.
 *
 * Usa el StorageService de la Fase 0 (inyectable; por defecto el singleton).
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { getStorageService, type StorageService } from '@/services/storage/StorageService';
import type { AppMeta } from '@/types/settings';
import type { PaymentMethod } from '@/types/payment';
import type {
  CreditInstallment,
  CreditPlan,
  Sale,
  SaleItem,
} from '@/types/sale';

/** Clave de storage para el metadato de secuencia de comprobantes. */
const META_KEY = 'meta';
/** Clave de storage para el historial de ventas. */
const SALES_KEY = 'sales';
/** Cantidad mínima de dígitos del número de comprobante GOP-XXXX. */
const RECEIPT_PAD = 4;
/** Días entre cuotas para el plan de 3 cuotas. */
const INSTALLMENT_INTERVAL_DAYS = 15;
/** Milisegundos por día. */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Resultado discriminado consistente para todas las operaciones. */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Línea del carrito para crear una venta. Incluye `kind` para poder rechazar
 * créditos que contengan servicios (Req 9.5). El `subtotal` se calcula en el
 * servicio; no es necesario proveerlo.
 */
export interface SaleLineInput {
  inventoryId: string;
  name: string;
  kind: 'product' | 'service';
  quantity: number;
  unitPrice: number;
}

/** Configuración del plan de crédito al crear la venta. */
export interface CreditPlanInput {
  type: 'single' | 'three_installments';
  /** Abono inicial (P ≥ 0). Se resta del total para repartir en cuotas. */
  initialPayment?: number;
  /** Fecha de la cuota única (ISO YYYY-MM-DD). Requerida para type 'single'. */
  singleDueDate?: string;
  /** Fecha de arranque del plan de 3 cuotas (ISO). Por defecto, hoy. */
  startDate?: string;
}

/** Payload para crear una venta. */
export interface CreateSaleInput {
  date?: string; // ISO YYYY-MM-DD; por defecto hoy
  clientType: 'student' | 'external';
  clientId?: string;
  clientName: string;
  items: SaleLineInput[];
  type: 'cash' | 'credit';
  method?: PaymentMethod;
  credit?: CreditPlanInput;
}

// =============================================================================
// Helpers de fecha (JS nativo, aritmética en UTC)
// =============================================================================

/** ISO `YYYY-MM-DD` de hoy en UTC. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parsea un ISO `YYYY-MM-DD` a un Date en UTC (medianoche). */
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Formatea un Date a ISO `YYYY-MM-DD` en UTC. */
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Suma `days` días a una fecha ISO y retorna ISO. */
function addDaysIso(iso: string, days: number): string {
  const base = parseIsoDate(iso);
  return toIsoDate(new Date(base.getTime() + days * MS_PER_DAY));
}

// =============================================================================
// Lógica pura (exportada para tests y reutilización)
// =============================================================================

/**
 * Calcula el subtotal de una línea: quantity * unitPrice.
 */
export function computeLineSubtotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

/**
 * Calcula el total de una venta como la suma estricta de los subtotales
 * (quantity * unitPrice) de cada línea (Req 9.2).
 */
export function computeSaleTotal(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
}

/**
 * Genera el plan de cuotas de crédito (Req 9.4).
 *
 * - `single`: exactamente 1 cuota por el monto restante (total - abono), en la
 *   fecha indicada (`singleDueDate`) o, por defecto, hoy.
 * - `three_installments`: exactamente 3 cuotas separadas 15 días entre sí, que
 *   reparten (total - abono). Se reparte en enteros y la última cuota absorbe
 *   el residuo para que la suma sea exacta (sin pérdida por redondeo).
 *
 * @param total Total de la venta.
 * @param initialPayment Abono inicial (P ≥ 0).
 * @param config Configuración del plan.
 */
export function buildCreditPlan(
  total: number,
  initialPayment: number,
  config: CreditPlanInput,
): CreditPlan {
  const remaining = total - initialPayment;

  if (config.type === 'single') {
    const dueDate = config.singleDueDate ?? todayIso();
    return {
      type: 'single',
      installments: [
        { number: 1, dueDate, amount: remaining, paid: false },
      ],
    };
  }

  // three_installments: 3 cuotas cada 15 días.
  const start = config.startDate ?? todayIso();
  const base = Math.floor(remaining / 3);
  const remainder = remaining - base * 3; // residuo entero que absorbe la última cuota
  const amounts = [base, base, base + remainder];

  const installments: CreditInstallment[] = amounts.map((amount, i) => ({
    number: i + 1,
    dueDate: addDaysIso(start, i * INSTALLMENT_INTERVAL_DAYS),
    amount,
    paid: false,
  }));

  return { type: 'three_installments', installments };
}

/**
 * Recalcula el saldo de un plan de crédito tras pagar una cuota (Req 9.6).
 *
 * Marca la cuota `installmentNumber` como pagada con `amountPaid`. Si el monto
 * pagado difiere del monto original de esa cuota, la diferencia se reparte
 * equitativamente entre las cuotas restantes NO pagadas, de modo que el saldo
 * total pendiente disminuya exactamente en `amountPaid`.
 *
 * Función pura: retorna un nuevo CreditPlan (no muta el original).
 */
export function recalcInstallments(
  plan: CreditPlan,
  installmentNumber: number,
  amountPaid: number,
  paidDate: string = todayIso(),
): CreditPlan {
  const target = plan.installments.find((i) => i.number === installmentNumber);
  if (!target || target.paid) {
    return plan;
  }

  const originalAmount = target.amount;
  const delta = amountPaid - originalAmount; // >0 pagó de más, <0 pagó de menos

  // Cuotas restantes no pagadas (excluyendo la que se está pagando ahora).
  const remainingUnpaid = plan.installments.filter(
    (i) => !i.paid && i.number !== installmentNumber,
  );

  const installments = plan.installments.map((inst) => {
    if (inst.number === installmentNumber) {
      return { ...inst, paid: true, paidAmount: amountPaid, paidDate, amount: amountPaid };
    }
    return { ...inst };
  });

  // Repartir -delta equitativamente sobre las cuotas restantes no pagadas.
  // Si pagó de más (delta>0), las restantes bajan; si pagó de menos, suben.
  if (remainingUnpaid.length > 0 && delta !== 0) {
    const spread = -delta;
    const per = Math.floor(spread / remainingUnpaid.length);
    let residue = spread - per * remainingUnpaid.length;

    for (const inst of installments) {
      if (!inst.paid && inst.number !== installmentNumber) {
        let adjust = per;
        if (residue !== 0) {
          // El residuo (positivo o negativo) se asigna de a una unidad.
          const unit = residue > 0 ? 1 : -1;
          adjust += unit;
          residue -= unit;
        }
        inst.amount += adjust;
      }
    }
  }

  return { ...plan, installments };
}

/** Calcula el saldo pendiente (suma de cuotas no pagadas) de un plan. */
export function remainingBalance(plan: CreditPlan): number {
  return plan.installments
    .filter((i) => !i.paid)
    .reduce((acc, i) => acc + i.amount, 0);
}

/** Formatea un número de secuencia como comprobante `GOP-XXXX`. */
export function formatReceiptNo(seq: number): string {
  return `GOP-${String(seq).padStart(RECEIPT_PAD, '0')}`;
}

// =============================================================================
// Servicio
// =============================================================================

export class SaleService {
  private storagePromise: Promise<StorageService>;

  constructor(storage?: StorageService) {
    this.storagePromise = storage ? Promise.resolve(storage) : getStorageService();
  }

  private async storage(): Promise<StorageService> {
    return this.storagePromise;
  }

  /**
   * Genera el siguiente número de comprobante `GOP-XXXX` leyendo e
   * incrementando el `seq` del AppMeta persistido (Req 9.7).
   */
  async generateReceiptNo(): Promise<string> {
    const storage = await this.storage();
    const meta = (await storage.get<AppMeta>(META_KEY)) ?? { seq: 1 };
    const receiptNo = formatReceiptNo(meta.seq);
    await storage.set<AppMeta>(META_KEY, { ...meta, seq: meta.seq + 1 });
    return receiptNo;
  }

  /**
   * Crea una venta (contado o crédito).
   *
   * - Total = Σ(quantity * unitPrice) por línea (Req 9.2).
   * - Crédito con servicios → rechazo (Req 9.5).
   * - Crédito válido → genera plan de cuotas (Req 9.3, 9.4).
   * - Genera comprobante secuencial (Req 9.7).
   *
   * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7
   */
  async createSale(input: CreateSaleInput): Promise<ServiceResult<Sale>> {
    if (input.items.length === 0) {
      return { success: false, error: 'La venta debe incluir al menos un ítem.' };
    }

    // Crédito con servicios: rechazar (Req 9.5).
    if (input.type === 'credit') {
      const hasService = input.items.some((item) => item.kind === 'service');
      if (hasService) {
        return {
          success: false,
          error: 'El crédito solo aplica para productos.',
        };
      }
    }

    // Construir líneas con subtotal calculado (Req 9.2).
    const items: SaleItem[] = input.items.map((line) => ({
      inventoryId: line.inventoryId,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      subtotal: computeLineSubtotal(line.quantity, line.unitPrice),
    }));

    const total = computeSaleTotal(items);

    // Plan de crédito (Req 9.3, 9.4).
    let creditPlan: CreditPlan | undefined;
    if (input.type === 'credit') {
      const config: CreditPlanInput = input.credit ?? { type: 'single' };
      const initialPayment = config.initialPayment ?? 0;
      if (initialPayment < 0 || initialPayment > total) {
        return {
          success: false,
          error: 'El abono inicial debe estar entre 0 y el total de la venta.',
        };
      }
      creditPlan = buildCreditPlan(total, initialPayment, config);
    }

    const receiptNo = await this.generateReceiptNo();

    const sale: Sale = {
      id: crypto.randomUUID(),
      date: input.date ?? todayIso(),
      clientType: input.clientType,
      clientId: input.clientId,
      clientName: input.clientName,
      items,
      total,
      type: input.type,
      method: input.method,
      receiptNo,
      creditPlan,
    };

    const storage = await this.storage();
    const sales = (await storage.get<Sale[]>(SALES_KEY)) ?? [];
    sales.push(sale);
    await storage.set<Sale[]>(SALES_KEY, sales);

    return { success: true, data: sale };
  }

  /**
   * Registra el pago de una cuota de un plan de crédito y recalcula el saldo
   * de las cuotas restantes si el monto pagado difiere del original (Req 9.6).
   *
   * Requirements: 9.6, 9.7
   */
  async payInstallment(
    saleId: string,
    installmentNumber: number,
    amountPaid: number,
  ): Promise<ServiceResult<Sale>> {
    if (amountPaid < 0) {
      return { success: false, error: 'El monto pagado no puede ser negativo.' };
    }

    const storage = await this.storage();
    const sales = (await storage.get<Sale[]>(SALES_KEY)) ?? [];
    const index = sales.findIndex((s) => s.id === saleId);

    if (index === -1) {
      return { success: false, error: 'Venta no encontrada.' };
    }

    const sale = sales[index];
    if (!sale.creditPlan) {
      return { success: false, error: 'La venta no tiene un plan de crédito.' };
    }

    const target = sale.creditPlan.installments.find((i) => i.number === installmentNumber);
    if (!target) {
      return { success: false, error: 'Cuota no encontrada.' };
    }
    if (target.paid) {
      return { success: false, error: 'La cuota ya fue pagada.' };
    }

    const updatedPlan = recalcInstallments(sale.creditPlan, installmentNumber, amountPaid);
    const updatedSale: Sale = { ...sale, creditPlan: updatedPlan };
    sales[index] = updatedSale;
    await storage.set<Sale[]>(SALES_KEY, sales);

    return { success: true, data: updatedSale };
  }

  /** Retorna todas las ventas persistidas. */
  async getAll(): Promise<Sale[]> {
    const storage = await this.storage();
    return (await storage.get<Sale[]>(SALES_KEY)) ?? [];
  }

  /** Retorna una venta por su id, o null. */
  async getById(id: string): Promise<Sale | null> {
    const sales = await this.getAll();
    return sales.find((s) => s.id === id) ?? null;
  }
}

/** Instancia singleton por conveniencia. */
export const saleService = new SaleService();
