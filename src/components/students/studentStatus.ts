/**
 * Helpers compartidos de presentación para el estado de un estudiante.
 *
 * Centraliza etiquetas legibles y los estilos semánticos (basados en las CSS
 * custom properties del Design System) para los badges de estado y de pago,
 * de modo que StudentList y StudentProfile los rendericen de forma consistente.
 */

import type { CSSProperties } from 'react';
import type { Student } from '@/types/student';
import type { PaymentStatus } from '@/services/StudentService';

/** Etiqueta legible para el estado del estudiante. */
export const STATUS_LABELS: Record<Student['status'], string> = {
  active: 'Activo',
  frozen: 'Congelado',
  inactive: 'Inactivo',
};

/**
 * Estilos inline del badge de estado, mapeados a las CSS vars semánticas:
 *  - active   -> verde (--status-active-*)
 *  - frozen   -> azul  (--status-frozen-*)
 *  - inactive -> gris  (--status-inactive-*)
 */
export function statusBadgeStyle(status: Student['status']): CSSProperties {
  return {
    backgroundColor: `var(--status-${status}-bg)`,
    color: `var(--status-${status}-text)`,
  };
}

/** Color del "punto" indicador para el estado. */
export function statusDotStyle(status: Student['status']): CSSProperties {
  return { backgroundColor: `var(--status-${status}-dot)` };
}

/** Etiqueta legible para el estado de pago. */
export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  al_dia: 'Al día',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
};

/** Estilos inline del badge de pago, mapeados a las CSS vars semánticas. */
export function paymentBadgeStyle(payment: PaymentStatus): CSSProperties {
  const token =
    payment === 'al_dia'
      ? 'current'
      : payment === 'por_vencer'
        ? 'expiring'
        : 'overdue';
  return {
    backgroundColor: `var(--payment-${token}-bg)`,
    color: `var(--payment-${token}-text)`,
  };
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Deriva el estado de pago de un estudiante en cliente, con la misma semántica
 * que StudentService.getPaymentStatus:
 *  - vencido:    subscriptionEndDate < hoy
 *  - al_dia:     subscriptionEndDate > hoy + 3 días
 *  - por_vencer: entre hoy y hoy + 3 días (inclusive)
 */
export function derivePaymentStatus(
  student: Student,
  now: Date = new Date(),
): PaymentStatus {
  const subEnd = new Date(student.subscriptionEndDate);
  if (Number.isNaN(subEnd.getTime())) return 'vencido';

  const diffDays = (subEnd.getTime() - now.getTime()) / MS_PER_DAY;
  if (diffDays < 0) return 'vencido';
  if (diffDays > 3) return 'al_dia';
  return 'por_vencer';
}

/** Formatea una fecha ISO (YYYY-MM-DD) a formato local legible. Vacío si inválida. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
