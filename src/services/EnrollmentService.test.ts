/**
 * Inscripción con primer pago: estudiante + pago + comprobante + ingreso,
 * o estudiante vencido sin ningún movimiento de dinero.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  enrollStudent,
  unpaidEndDate,
  type EnrollmentDeps,
  type FirstPaymentInput,
} from './EnrollmentService';
import { StudentService, type StudentRegistration } from './StudentService';
import { PaymentService } from './PaymentService';
import { FinanceService } from './FinanceService';
import { createStorageService, resetStorageService } from './storage/StorageService';
import type { StorageService } from './storage/StorageService';
import { todayLocalIso } from '@/utils/validation';

const registration = (documentId = '1001'): StudentRegistration =>
  ({
    photo: '', firstName: 'Ana', lastName: 'Gómez', documentId,
    isMinor: false, guardianName: '', guardianDocument: '', phone: '3001234567', email: '',
    emergencyName: '', emergencyPhone: '', emergencyRelation: '', dateOfBirth: '', bloodType: '',
    firstRegistrationDate: todayLocalIso(), recentRegistrationDate: todayLocalIso(),
    registrationDate: todayLocalIso(), subscriptionEndDate: '2099-01-01', monthlyFee: 110000,
    planCategory: 'mensualidad', planName: 'Premium', planId: 'grp_premium',
    payments: [], courtesyBonuses: [], medicalNotes: '', beltRank: '',
    consent: { signed: false, signedDate: '', signedVersion: 0, signature: '' },
  }) as StudentRegistration;

const firstPayment = (over: Partial<FirstPaymentInput> = {}): FirstPaymentInput => ({
  date: todayLocalIso(),
  amount: 110000,
  method: 'Nequi',
  planName: 'Premium',
  category: 'mensualidad',
  ...over,
});

let storage: StorageService;
let students: StudentService;
let payments: PaymentService;
let deps: EnrollmentDeps;

beforeEach(async () => {
  localStorage.clear();
  resetStorageService();
  storage = await createStorageService();
  students = new StudentService();
  payments = new PaymentService(storage);
  deps = {
    createStudent: (d) => students.register(d),
    removeStudent: (id) => students.delete(id),
    registerPayment: (input, options) => payments.registerPayment(input, options),
  };
});

afterEach(() => {
  localStorage.clear();
  resetStorageService();
});

describe('enrollStudent', () => {
  it('con pago: estudiante al día, pago con comprobante e ingreso en caja', async () => {
    const result = await enrollStudent(registration(), firstPayment(), deps);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.payment?.receiptNo).toMatch(/^GOP-\d{4}$/);

    const [stored] = await students.getAll();
    expect(stored.payments).toHaveLength(1);
    expect(stored.payments[0]).toMatchObject({ amount: 110000, method: 'Nequi', receiptNo: result.payment?.receiptNo });
    // Al día: vence más de 3 días después de hoy.
    expect((await students.filter({ paymentStatus: 'al_dia' })).map((s) => s.id)).toEqual([stored.id]);

    expect(await payments.getAll()).toHaveLength(1);
    const movements = await new FinanceService(storage).getAll();
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: 'income', amount: 110000, studentId: stored.id, method: 'Nequi' });
  });

  it('sin pago: queda vencido y no genera pagos ni ingresos', async () => {
    const result = await enrollStudent(registration(), null, deps);
    expect(result.success).toBe(true);

    const [stored] = await students.getAll();
    expect(stored.subscriptionEndDate).toBe(unpaidEndDate());
    expect(stored.payments).toHaveLength(0);
    expect((await students.filter({ paymentStatus: 'vencido' })).map((s) => s.id)).toEqual([stored.id]);
    expect(await students.filter({ paymentStatus: 'al_dia' })).toHaveLength(0);
    expect(await payments.getAll()).toHaveLength(0);
    expect(await new FinanceService(storage).getAll()).toHaveLength(0);
  });

  it('no deja un vencimiento futuro aunque el formulario lo traiga', async () => {
    await enrollStudent(registration(), null, deps);
    const [stored] = await students.getAll();
    expect(stored.subscriptionEndDate).not.toBe('2099-01-01');
  });

  it('monto cero o negativo se rechaza sin crear nada', async () => {
    for (const amount of [0, -5, NaN]) {
      const r = await enrollStudent(registration(), firstPayment({ amount }), deps);
      expect(r.success).toBe(false);
    }
    expect(await students.getAll()).toHaveLength(0);
    expect(await payments.getAll()).toHaveLength(0);
  });

  it('si el pago falla, el estudiante se revierte y se puede reintentar', async () => {
    const failing: EnrollmentDeps = {
      ...deps,
      registerPayment: async () => ({ success: false, error: 'boom' }),
    };
    const r = await enrollStudent(registration(), firstPayment(), failing);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain('boom');
    expect(await students.getAll()).toHaveLength(0);

    const retry = await enrollStudent(registration(), firstPayment(), deps);
    expect(retry.success).toBe(true);
  });

  it('si el pago y el rollback fallan, lo informa', async () => {
    const broken: EnrollmentDeps = {
      ...deps,
      registerPayment: async () => ({ success: false, error: 'boom' }),
      removeStudent: async () => {
        throw new Error('sin red');
      },
    };
    const r = await enrollStudent(registration(), firstPayment(), broken);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/quedó creado sin pago/);
  });

  it('documento duplicado: no registra pago ni ingreso', async () => {
    await enrollStudent(registration('2002'), null, deps);
    const r = await enrollStudent(registration('2002'), firstPayment(), deps);
    expect(r.success).toBe(false);
    expect(await payments.getAll()).toHaveLength(0);
    expect(await new FinanceService(storage).getAll()).toHaveLength(0);
  });

  it('sin sección de pago (undefined) conserva el comportamiento previo', async () => {
    const r = await enrollStudent(registration(), undefined, deps);
    expect(r.success).toBe(true);
    const [stored] = await students.getAll();
    expect(stored.subscriptionEndDate).toBe('2099-01-01');
  });

  it('clase única: vence el día del pago', async () => {
    const date = todayLocalIso();
    await enrollStudent(registration(), firstPayment({ single: true, date }), deps);
    const [stored] = await students.getAll();
    expect(stored.subscriptionEndDate).toBe(date);
  });
});
