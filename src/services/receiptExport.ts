/**
 * receiptExport — Listado, filtros y resumen CSV de los comprobantes de pago.
 * Funciones puras: la UI decide cuándo descargar.
 */

import type { Payment, PaymentMethod } from '@/types/payment';
import type { Student } from '@/types/student';
import type { ReceiptClientInfo } from '@/services/ReceiptService';
import { formatDocument } from '@/utils/validation';

export interface ReceiptRow {
  payment: Payment;
  client: ReceiptClientInfo;
}

export interface ReceiptFilter {
  search: string;
  from: string;
  to: string;
  method?: PaymentMethod;
}

function clientOf(student: Student): ReceiptClientInfo {
  return {
    name: `${student.firstName} ${student.lastName}`,
    documentId: formatDocument(student.documentId, student.documentType),
    phone: student.phone,
    email: student.email,
  };
}

/** Total realmente pagado: `amount` es el valor bruto. */
export function netAmount(payment: Payment): number {
  return payment.amount - (payment.discount ?? 0);
}

/**
 * Une los pagos guardados en cada estudiante (modo local) con los que trae la
 * colección con `studentId` (modo API), del más reciente al más antiguo.
 */
export function buildReceiptRows(students: Student[], payments: Payment[]): ReceiptRow[] {
  const byId = new Map(students.map((s) => [s.id, s]));
  const rows = new Map<string, ReceiptRow>();

  for (const student of students) {
    for (const payment of student.payments ?? []) {
      rows.set(payment.id, { payment, client: clientOf(student) });
    }
  }

  for (const payment of payments) {
    if (!payment.studentId || rows.has(payment.id)) continue;
    const student = byId.get(payment.studentId);
    rows.set(payment.id, {
      payment,
      client: student
        ? clientOf(student)
        : { name: 'Estudiante eliminado', documentId: payment.studentId },
    });
  }

  return [...rows.values()].sort((a, b) => b.payment.date.localeCompare(a.payment.date));
}

export function filterReceiptRows(rows: ReceiptRow[], filter: ReceiptFilter): ReceiptRow[] {
  const search = filter.search.trim().toLowerCase();
  return rows.filter(({ payment, client }) => {
    const date = payment.date.slice(0, 10);
    if (filter.from && date < filter.from) return false;
    if (filter.to && date > filter.to) return false;
    if (filter.method) {
      const usedMethods = payment.splits?.length
        ? payment.splits.map((s) => s.method)
        : [payment.method];
      if (!usedMethods.includes(filter.method)) return false;
    }
    return (
      !search ||
      [payment.receiptNo ?? '', client.name, client.documentId].some((value) =>
        value.toLowerCase().includes(search),
      )
    );
  });
}

/** Un texto que empiece por =, +, - o @ Excel lo ejecutaría como fórmula. */
function csvCell(value: string | number): string {
  if (typeof value === 'number') return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const STATUS_LABEL: Record<Payment['status'], string> = {
  paid: 'Pagado',
  upgrade: 'Mejora de plan',
  credit: 'Crédito',
};

/** CSV con punto y coma, que es lo que Excel espera con configuración regional de Colombia. */
export function buildReceiptsCsv(rows: ReceiptRow[]): string {
  const header = [
    'Comprobante', 'Fecha', 'Estudiante', 'Documento', 'Plan',
    'Tipo', 'Método', 'Subtotal', 'Descuento', 'Total',
  ];
  const lines = rows.map(({ payment, client }) =>
    [
      payment.receiptNo ?? 'SIN-NUMERO',
      payment.date.slice(0, 10),
      client.name,
      client.documentId,
      payment.planName,
      STATUS_LABEL[payment.status],
      payment.splits?.length
        ? payment.splits.map((s) => `${s.method} ${s.amount}`).join(', ')
        : payment.method,
      payment.amount,
      payment.discount ?? 0,
      netAmount(payment),
    ]
      .map(csvCell)
      .join(';'),
  );
  return [header.join(';'), ...lines].join('\r\n');
}
