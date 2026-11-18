/**
 * EnrollmentService — Inscripción de un estudiante con su primer pago.
 *
 * Coordina, de forma secuencial y con compensación, la creación del estudiante
 * y su primer pago (comprobante GOP-XXXX + ingreso a caja), de modo que nadie
 * quede "al día" sin un pago registrado detrás.
 *
 *  - Con pago: el estudiante se crea ya vencido y el pago extiende la membresía.
 *    Si el pago falla, el estudiante se elimina (rollback) para poder reintentar.
 *  - Sin pago (`firstPayment === null`): el estudiante se crea vencido, sin
 *    pago ni ingreso.
 *  - `firstPayment === undefined`: no se toca nada (formulario sin sección de pago).
 *
 * Las dependencias se inyectan para no acoplar el flujo a hooks ni al storage.
 */

import { addDays, format } from 'date-fns';

import type {
  PaymentInput,
  RegisterPaymentResult,
  ServiceResult,
} from '@/services/PaymentService';
import type { StudentRegistration } from '@/services/StudentService';
import type { PaymentMethod } from '@/types/payment';
import type { Student } from '@/types/student';

/** Datos del primer pago capturados en el formulario de inscripción. */
export interface FirstPaymentInput {
  /** Fecha del pago (ISO YYYY-MM-DD). */
  date: string;
  /** Monto cobrado en COP (> 0). */
  amount: number;
  method: PaymentMethod;
  planName: string;
  category: 'mensualidad' | 'personalizada';
  /** Plan de clase única: no extiende el vencimiento. */
  single?: boolean;
}

export interface EnrollmentDeps {
  createStudent: (data: StudentRegistration) => Promise<ServiceResult<Student>>;
  removeStudent: (id: string) => Promise<ServiceResult<string>>;
  registerPayment: (
    input: PaymentInput,
    options: { currentSubscriptionEndDate?: string; plan?: { single?: boolean } },
  ) => Promise<ServiceResult<RegisterPaymentResult>>;
}

export type EnrollmentResult =
  | { success: true; student: Student; payment?: RegisterPaymentResult }
  | { success: false; error: string };

/** Vencimiento de quien aún no ha pagado: ayer, es decir, "vencido". */
export function unpaidEndDate(today: Date = new Date()): string {
  return format(addDays(today, -1), 'yyyy-MM-dd');
}

export async function enrollStudent(
  data: StudentRegistration,
  firstPayment: FirstPaymentInput | null | undefined,
  deps: EnrollmentDeps,
): Promise<EnrollmentResult> {
  // Sin sección de pago en el formulario: comportamiento previo.
  if (firstPayment === undefined) {
    const result = await deps.createStudent(data);
    return result.success ? { success: true, student: result.data } : result;
  }

  if (firstPayment !== null && !(firstPayment.amount > 0)) {
    return { success: false, error: 'El monto del primer pago debe ser mayor a cero.' };
  }

  // En ambos casos nace vencido: solo un pago real lo deja al día.
  const unpaidEnd = unpaidEndDate();
  const created = await deps.createStudent({ ...data, subscriptionEndDate: unpaidEnd });
  if (!created.success) return created;
  if (firstPayment === null) return { success: true, student: created.data };

  const paid = await deps.registerPayment(
    {
      studentId: created.data.id,
      date: firstPayment.date,
      amount: firstPayment.amount,
      method: firstPayment.method,
      status: 'paid',
      planName: firstPayment.planName,
      category: firstPayment.category,
      discount: 0,
    },
    {
      // La clase única vence el día del pago; el resto, un mes después.
      currentSubscriptionEndDate: firstPayment.single ? firstPayment.date : unpaidEnd,
      plan: { single: firstPayment.single },
    },
  );

  if (!paid.success) {
    const rollback = await deps.removeStudent(created.data.id).catch(
      (): ServiceResult<string> => ({ success: false, error: 'rollback' }),
    );
    return {
      success: false,
      error: rollback.success
        ? `No se registró el pago, así que el estudiante no se creó: ${paid.error}`
        : `No se pudo registrar el pago (${paid.error}) y el estudiante quedó creado sin pago. Regístralo desde su perfil.`,
    };
  }

  return { success: true, student: created.data, payment: paid.data };
}
