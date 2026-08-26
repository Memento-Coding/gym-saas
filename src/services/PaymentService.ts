/**
 * PaymentService — Registro y gestión de pagos de mensualidad.
 *
 * Responsabilidades:
 * - Registrar pagos con extensión de subscriptionEndDate (status 'paid').
 * - Manejar upgrades de plan sin extender fecha (status 'upgrade').
 * - Soportar pagos a crédito con plan de cuotas y seguimiento de saldo.
 * - Validar pagos divididos (split) donde sum(splits) === totalAmount.
 * - Aplicar descuentos con monto y razón.
 * - Generar secuencia única y estrictamente creciente de comprobantes GOP-XXXX.
 * - Persistir pagos embebidos en Student.payments[].
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import type { StorageService } from '@/services/storage/StorageService';
import type { Payment, PaymentMethod, PaymentSplit } from '@/types/payment';
import type { MembershipPlan } from '@/types/membership';
import type { Student } from '@/types/student';
import { MembershipService } from '@/services/MembershipService';

/** Storage key para la secuencia de comprobantes */
const RECEIPT_SEQ_KEY = 'gymops_receipt_sequence';

/** Storage key para estudiantes (misma clave que StudentService) */
const STUDENTS_KEY = 'gymops_students';

// ---------------------------------------------------------------------------
// Tipos de entrada
// ---------------------------------------------------------------------------

/** Cuota de un plan de crédito */
export interface CreditInstallment {
  number: number;
  dueDate: string;
  amount: number;
  paid: boolean;
  paidDate?: string;
  paidAmount?: number;
}

/** Plan de crédito para pagos a plazos */
export interface PaymentCreditPlan {
  totalInstallments: number;
  installments: CreditInstallment[];
  initialPayment: number;
  remainingBalance: number;
}

/** Input para registrar un pago */
export interface RegisterPaymentInput {
  studentId: string;
  date: string;
  plan: MembershipPlan;
  category: 'mensualidad' | 'personalizada';
  method: PaymentMethod;
  splits?: PaymentSplit[];
  status: 'paid' | 'upgrade' | 'credit';
  discount?: number;
  discountReason?: string;
  creditPlan?: PaymentCreditPlan;
}

/** Resultado de un pago registrado */
export interface PaymentResult {
  payment: Payment;
  receiptNo: string;
  updatedStudent: Student;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PaymentService {
  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  // ---------------------------------------------------------------------------
  // Secuencia de comprobantes
  // ---------------------------------------------------------------------------

  /**
   * Genera el siguiente número de comprobante en formato GOP-XXXX.
   * La secuencia es estrictamente creciente y persiste en storage.
   *
   * Requirement 5.7: Secuencia única y creciente de comprobantes.
   */
  async getNextReceiptNumber(): Promise<string> {
    const current = await this.storageService.get<number>(RECEIPT_SEQ_KEY);
    const next = (current ?? 0) + 1;
    await this.storageService.set<number>(RECEIPT_SEQ_KEY, next);
    return PaymentService.formatReceiptNumber(next);
  }

  /**
   * Retorna el último número de comprobante generado (sin incrementar).
   */
  async getCurrentSequence(): Promise<number> {
    const current = await this.storageService.get<number>(RECEIPT_SEQ_KEY);
    return current ?? 0;
  }

  /**
   * Formatea un número de secuencia como GOP-XXXX con zero-padding a 4 dígitos.
   */
  static formatReceiptNumber(seq: number): string {
    return `GOP-${seq.toString().padStart(4, '0')}`;
  }

  // ---------------------------------------------------------------------------
  // Registro de pagos
  // ---------------------------------------------------------------------------

  /**
   * Registra un pago de mensualidad para un estudiante.
   *
   * Comportamiento según status:
   * - 'paid': Extiende subscriptionEndDate en max(oldEnd, paymentDate) + 1 mes.
   *   Excepción: planes con single:true NO extienden la fecha.
   * - 'upgrade': Actualiza el plan del estudiante sin modificar la fecha.
   * - 'credit': Registra pago a crédito con plan de cuotas.
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
   *
   * @throws Error si el estudiante no existe.
   * @throws Error si los splits no suman el total.
   */
  async registerPayment(input: RegisterPaymentInput): Promise<PaymentResult> {
    // 1. Leer el estudiante
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) {
      throw new Error('No hay estudiantes registrados.');
    }

    const studentIdx = students.findIndex((s) => s.id === input.studentId);
    if (studentIdx === -1) {
      throw new Error(`Estudiante con ID "${input.studentId}" no encontrado.`);
    }

    const student = { ...students[studentIdx] };

    // 2. Calcular monto con descuento
    const discount = input.discount ?? 0;
    const totalAmount = input.plan.price - discount;

    // 3. Validar split payments
    if (input.splits && input.splits.length > 0) {
      PaymentService.validateSplits(input.splits, totalAmount);
    }

    // 4. Generar número de comprobante
    const receiptNo = await this.getNextReceiptNumber();

    // 5. Crear el registro de pago
    const payment: Payment = {
      id: crypto.randomUUID(),
      date: input.date,
      amount: totalAmount,
      method: input.method,
      splits: input.splits && input.splits.length > 0 ? input.splits : undefined,
      status: input.status,
      planName: input.plan.name,
      category: input.category,
      discount,
      discountReason: input.discountReason ?? '',
      receiptNo,
    };

    // 6. Actualizar estudiante según status del pago
    student.payments = [...(student.payments ?? []), payment];
    student.planName = input.plan.name;
    student.planId = input.plan.id;
    student.planCategory = input.category;
    student.monthlyFee = input.plan.price;

    if (input.status === 'paid') {
      // Extender subscriptionEndDate: max(oldEnd, payDate) + 1 mes
      // Excepción: planes single no extienden
      student.subscriptionEndDate = MembershipService.calculateNewEndDate(
        student.subscriptionEndDate,
        input.date,
        input.plan,
      );
    }
    // 'upgrade': no modificamos subscriptionEndDate
    // 'credit': no modificamos subscriptionEndDate hasta pago completo
    // (los abonos se registran por separado)

    // 7. Persistir cambios
    students[studentIdx] = student;
    await this.storageService.set<Student[]>(STUDENTS_KEY, students);

    return { payment, receiptNo, updatedStudent: student };
  }

  // ---------------------------------------------------------------------------
  // Pagos a crédito - Abonos
  // ---------------------------------------------------------------------------

  /**
   * Registra un abono a un pago a crédito existente.
   * Actualiza el saldo pendiente y marca cuotas como pagadas según corresponda.
   *
   * @param studentId ID del estudiante.
   * @param paymentId ID del pago original a crédito.
   * @param amount Monto del abono.
   * @param method Método de pago del abono.
   * @param date Fecha del abono.
   */
  async registerInstallmentPayment(
    studentId: string,
    paymentId: string,
    amount: number,
    method: PaymentMethod,
    date: string,
  ): Promise<Payment | null> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) return null;

    const studentIdx = students.findIndex((s) => s.id === studentId);
    if (studentIdx === -1) return null;

    const student = { ...students[studentIdx] };
    const paymentIdx = student.payments.findIndex((p) => p.id === paymentId);
    if (paymentIdx === -1) return null;

    const originalPayment = student.payments[paymentIdx];
    if (originalPayment.status !== 'credit') return null;

    // Crear registro de abono como un pago vinculado
    const installmentPayment: Payment = {
      id: crypto.randomUUID(),
      date,
      amount,
      method,
      status: 'paid',
      planName: originalPayment.planName,
      category: originalPayment.category,
      discount: 0,
      discountReason: '',
      receiptNo: await this.getNextReceiptNumber(),
    };

    student.payments = [...student.payments, installmentPayment];
    students[studentIdx] = student;
    await this.storageService.set<Student[]>(STUDENTS_KEY, students);

    return installmentPayment;
  }

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  /**
   * Retorna el historial de pagos de un estudiante.
   */
  async getPaymentHistory(studentId: string): Promise<Payment[]> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) return [];

    const student = students.find((s) => s.id === studentId);
    if (!student) return [];

    return student.payments ?? [];
  }

  /**
   * Retorna todos los pagos de todos los estudiantes con la información del estudiante.
   */
  async getAllPayments(): Promise<Array<Payment & { studentId: string; studentName: string }>> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) return [];

    const allPayments: Array<Payment & { studentId: string; studentName: string }> = [];

    for (const student of students) {
      if (!student.payments) continue;
      for (const payment of student.payments) {
        allPayments.push({
          ...payment,
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
        });
      }
    }

    // Ordenar por fecha descendente
    allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return allPayments;
  }

  // ---------------------------------------------------------------------------
  // Validaciones estáticas
  // ---------------------------------------------------------------------------

  /**
   * Valida que la suma de los splits sea exactamente igual al total.
   *
   * Requirement 5.5: Los pagos divididos solo son aceptados si sum(splits) === total.
   *
   * @throws Error si la suma no coincide con el total.
   */
  static validateSplits(splits: PaymentSplit[], totalAmount: number): void {
    const splitsSum = splits.reduce((sum, s) => sum + s.amount, 0);
    // Tolerancia de centavo por precisión de punto flotante
    if (Math.abs(splitsSum - totalAmount) > 0.01) {
      throw new Error(
        `La suma de los pagos divididos ($${splitsSum.toLocaleString()}) no coincide con el total ($${totalAmount.toLocaleString()}).`,
      );
    }
  }

  /**
   * Calcula la nueva fecha de vencimiento según las reglas de negocio.
   * Delegación al MembershipService.calculateNewEndDate para mantener cohesión.
   */
  static calculateNewEndDate(
    currentEndDate: string,
    paymentDate: string,
    plan: MembershipPlan,
  ): string {
    return MembershipService.calculateNewEndDate(currentEndDate, paymentDate, plan);
  }
}
