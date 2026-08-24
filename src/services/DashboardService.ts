/**
 * DashboardService — Cálculo de métricas, alertas y utilidades del dashboard.
 *
 * Este servicio NO instancia persistencia: expone únicamente funciones puras
 * que reciben arrays de datos (Student[], FinanceMovement[]) y retornan las
 * métricas y alertas derivadas. Esto lo hace trivialmente testeable con
 * property-based testing.
 *
 * Responsabilidades:
 * - calculateMetrics: conteo mutuamente excluyente de estudiantes por categoría
 *   (activos al día, por vencer, vencidos, congelados, inactivos) + total recaudado.
 * - generateAlerts: lista de alertas ordenadas ESTRICTAMENTE por urgencia.
 * - isBirthdayToday: comparación de mes y día ignorando el año.
 *
 * Requirements: 10.1, 10.2, 10.4
 */

import type { Student } from '@/types/student';
import type { FinanceMovement } from '@/types/finance';

/** Días de atraso a partir de los cuales un estudiante activo se considera inactivo. */
const OVERDUE_DAYS_FOR_INACTIVE = 15;

/** Días o menos para considerar una membresía "por vencer". */
const ABOUT_TO_EXPIRE_DAYS = 3;

/** Días o menos para considerar una cuota de cartera "por vencer". */
const INSTALLMENT_ABOUT_TO_EXPIRE_DAYS = 3;

/** Categorías mutuamente excluyentes de un estudiante para el dashboard. */
export type StudentCategory =
  | 'active_upToDate'
  | 'aboutToExpire'
  | 'expired'
  | 'frozen'
  | 'inactive';

export interface DashboardMetrics {
  activeUpToDate: number;
  aboutToExpire: number;
  expired: number;
  frozen: number;
  inactive: number;
  total: number;
  totalCollected: number;
}

/** Tipos de alerta ordenados por urgencia (menor = más urgente). */
export type AlertType =
  | 'membership_expired'
  | 'membership_expiring'
  | 'installment_expiring'
  | 'no_consent';

/** Prioridad numérica por tipo de alerta. Menor número = mayor urgencia. */
export const ALERT_PRIORITY: Record<AlertType, number> = {
  membership_expired: 0,
  membership_expiring: 1,
  installment_expiring: 2,
  no_consent: 3,
};

export interface DashboardAlert {
  type: AlertType;
  priority: number;
  studentId: string;
  studentName: string;
  message: string;
}

/**
 * Convierte una fecha (ISO o Date) al inicio del día en tiempo local,
 * para comparaciones de días completos sin ruido de horas.
 */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Diferencia en días completos entre `target` y `reference`
 * (target - reference). Positivo = target en el futuro.
 */
function daysBetween(target: Date, reference: Date): number {
  const ms = startOfDay(target).getTime() - startOfDay(reference).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Clasifica a un estudiante en exactamente UNA categoría, de forma
 * mutuamente excluyente. El orden de evaluación garantiza que ningún
 * estudiante quede en más de una categoría:
 *   1. frozen        (status === 'frozen')
 *   2. inactive      (status === 'inactive' o atraso > 15 días)
 *   3. expired       (vencimiento en el pasado, dentro de 15 días de gracia)
 *   4. aboutToExpire (vence en <= 3 días)
 *   5. active_upToDate (resto)
 *
 * Requirement 10.1
 */
export function classifyStudent(student: Student, now: Date = new Date()): StudentCategory {
  if (student.status === 'frozen') {
    return 'frozen';
  }
  if (student.status === 'inactive') {
    return 'inactive';
  }

  const end = new Date(student.subscriptionEndDate);

  // Si la fecha de vencimiento es inválida, tratamos al estudiante como inactivo.
  if (Number.isNaN(end.getTime())) {
    return 'inactive';
  }

  const daysUntilEnd = daysBetween(end, now);

  // Atraso mayor a 15 días → auto-desactivación (Requirement 3.5)
  if (daysUntilEnd < -OVERDUE_DAYS_FOR_INACTIVE) {
    return 'inactive';
  }

  // Vencido (fecha en el pasado pero dentro del período de gracia de 15 días)
  if (daysUntilEnd < 0) {
    return 'expired';
  }

  // Por vencer en 3 días o menos
  if (daysUntilEnd <= ABOUT_TO_EXPIRE_DAYS) {
    return 'aboutToExpire';
  }

  // Al día
  return 'active_upToDate';
}

/**
 * Calcula las métricas del dashboard a partir de la lista de estudiantes y los
 * movimientos financieros. Las categorías de estudiantes son mutuamente
 * excluyentes y suman exactamente el total de estudiantes.
 *
 * El total recaudado es la suma de los ingresos (type === 'income') de los
 * movimientos financieros.
 *
 * Requirement 10.1
 */
export function calculateMetrics(
  students: Student[],
  movements: FinanceMovement[] = [],
  now: Date = new Date(),
): DashboardMetrics {
  const metrics: DashboardMetrics = {
    activeUpToDate: 0,
    aboutToExpire: 0,
    expired: 0,
    frozen: 0,
    inactive: 0,
    total: students.length,
    totalCollected: 0,
  };

  for (const student of students) {
    const category = classifyStudent(student, now);
    switch (category) {
      case 'active_upToDate':
        metrics.activeUpToDate += 1;
        break;
      case 'aboutToExpire':
        metrics.aboutToExpire += 1;
        break;
      case 'expired':
        metrics.expired += 1;
        break;
      case 'frozen':
        metrics.frozen += 1;
        break;
      case 'inactive':
        metrics.inactive += 1;
        break;
    }
  }

  metrics.totalCollected = movements.reduce(
    (acc, m) => (m.type === 'income' ? acc + m.amount : acc),
    0,
  );

  return metrics;
}

/** Nombre legible de un estudiante para los mensajes de alerta. */
function studentDisplayName(student: Student): string {
  return `${student.firstName} ${student.lastName}`.trim();
}

/**
 * Genera la lista de alertas ordenada ESTRICTAMENTE por urgencia:
 *   1. membership_expired    (membresías vencidas)
 *   2. membership_expiring   (por vencer en <= 3 días)
 *   3. installment_expiring  (cuotas de cartera por vencer)
 *   4. no_consent            (estudiantes sin consentimiento firmado)
 *
 * La función recibe opcionalmente las cuotas de cartera por vencer, ya que la
 * lógica de créditos/ventas pertenece a otro track. Si no se proveen, esa
 * categoría simplemente no genera alertas.
 *
 * Requirement 10.2
 */
export function generateAlerts(
  students: Student[],
  options: {
    now?: Date;
    /** Cuotas de cartera con su fecha de vencimiento y estudiante asociado. */
    installments?: { studentId: string; dueDate: string; amount: number }[];
  } = {},
): DashboardAlert[] {
  const now = options.now ?? new Date();
  const alerts: DashboardAlert[] = [];

  const studentById = new Map(students.map((s) => [s.id, s]));

  for (const student of students) {
    // Solo consideramos vencimiento de membresía para estudiantes no inactivos
    // ni congelados (los inactivos ya no tienen membresía vigente que avisar).
    if (student.status === 'active') {
      const end = new Date(student.subscriptionEndDate);
      if (!Number.isNaN(end.getTime())) {
        const daysUntilEnd = daysBetween(end, now);
        if (daysUntilEnd < 0) {
          alerts.push({
            type: 'membership_expired',
            priority: ALERT_PRIORITY.membership_expired,
            studentId: student.id,
            studentName: studentDisplayName(student),
            message: `Membresía vencida hace ${Math.abs(daysUntilEnd)} día(s).`,
          });
        } else if (daysUntilEnd <= ABOUT_TO_EXPIRE_DAYS) {
          alerts.push({
            type: 'membership_expiring',
            priority: ALERT_PRIORITY.membership_expiring,
            studentId: student.id,
            studentName: studentDisplayName(student),
            message: `Membresía por vencer en ${daysUntilEnd} día(s).`,
          });
        }
      }
    }
  }

  // Cuotas de cartera por vencer (<= 3 días, incluyendo ya vencidas)
  for (const inst of options.installments ?? []) {
    const due = new Date(inst.dueDate);
    if (Number.isNaN(due.getTime())) continue;
    const daysUntilDue = daysBetween(due, now);
    if (daysUntilDue <= INSTALLMENT_ABOUT_TO_EXPIRE_DAYS) {
      const student = studentById.get(inst.studentId);
      alerts.push({
        type: 'installment_expiring',
        priority: ALERT_PRIORITY.installment_expiring,
        studentId: inst.studentId,
        studentName: student ? studentDisplayName(student) : 'Cliente',
        message: `Cuota de cartera por vencer (${inst.amount}).`,
      });
    }
  }

  // Estudiantes sin consentimiento firmado
  for (const student of students) {
    if (!student.consent?.signed) {
      alerts.push({
        type: 'no_consent',
        priority: ALERT_PRIORITY.no_consent,
        studentId: student.id,
        studentName: studentDisplayName(student),
        message: 'Consentimiento sin firmar.',
      });
    }
  }

  // Orden estable por prioridad (menor prioridad numérica primero = más urgente)
  return alerts.sort((a, b) => a.priority - b.priority);
}

/**
 * Retorna true si y solo si el mes y el día de `dateOfBirth` coinciden con los
 * de la fecha actual, ignorando el año.
 *
 * Usa parseo por componentes de la porción de fecha (YYYY-MM-DD) para evitar
 * corrimientos por zona horaria. Retorna false si la fecha es inválida.
 *
 * Requirement 10.4
 */
export function isBirthdayToday(dateOfBirth: string, now: Date = new Date()): boolean {
  if (!dateOfBirth) return false;

  // Extrae la porción de fecha (soporta 'YYYY-MM-DD' y 'YYYY-MM-DDTHH:mm:ss...')
  const datePart = dateOfBirth.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return false;

  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  // getMonth() es 0-indexado; sumamos 1 para comparar con el mes 1-indexado.
  return month === now.getMonth() + 1 && day === now.getDate();
}
