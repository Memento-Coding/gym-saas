/**
 * Unit & Property-based tests for PaymentService.
 *
 * Property 12: Pagos normales extienden subscriptionEndDate en max(oldDate, payDate) + 1 mes.
 *              Planes single o status upgrade NO alteran la fecha.
 *
 * Property 13: Pagos divididos solo son aceptados si sum(splits) === total.
 *
 * Uses: Vitest + fast-check
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createStorageService, resetStorageService } from '@/services/storage/StorageService';
import type { StorageService } from '@/services/storage/StorageService';
import { PaymentService, formatReceiptNo } from '@/services/PaymentService';
import type { MembershipPlan } from '@/types/membership';
import type { Student } from '@/types/student';
import type { PaymentSplit } from '@/types/payment';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STUDENTS_KEY = 'gymops_students';

/** Crea un estudiante base para tests */
function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'test-student-001',
    photo: '',
    firstName: 'Juan',
    lastName: 'Pérez',
    documentId: '123456789',
    isMinor: false,
    guardianName: '',
    guardianDocument: '',
    phone: '3001234567',
    email: 'juan@test.com',
    emergencyName: 'María',
    emergencyPhone: '3009876543',
    emergencyRelation: 'Madre',
    dateOfBirth: '1995-03-15',
    bloodType: 'O+',
    firstRegistrationDate: '2025-01-01',
    recentRegistrationDate: '2025-01-01',
    registrationDate: '2025-01-01',
    subscriptionEndDate: '2025-06-15',
    monthlyFee: 110000,
    planCategory: 'mensualidad',
    planName: 'Premium',
    planId: 'grp_premium',
    payments: [],
    courtesyBonuses: [],
    medicalNotes: '',
    status: 'active',
    beltRank: 'Blanco',
    consent: { signed: false, signedDate: '', signedVersion: 0, signature: '' },
    ...overrides,
  };
}

const NORMAL_PLAN: MembershipPlan = {
  id: 'grp_premium',
  name: 'Premium',
  price: 110000,
};

const SINGLE_PLAN: MembershipPlan = {
  id: 'grp_clase_unica',
  name: 'Clase única',
  price: 20000,
  single: true,
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PaymentService', () => {
  let storage: StorageService;
  let paymentService: PaymentService;

  beforeEach(async () => {
    localStorage.clear();
    resetStorageService();
    storage = await createStorageService();
    paymentService = new PaymentService(storage);
  });

  afterEach(() => {
    localStorage.clear();
    resetStorageService();
  });

  // ---------------------------------------------------------------------------
  // Property 12: Extensión de subscriptionEndDate
  // ---------------------------------------------------------------------------

  describe('Property 12: subscriptionEndDate extension', () => {
    it('should extend subscriptionEndDate by 1 month from max(oldEnd, payDate) for paid status', async () => {
      const student = makeStudent({ subscriptionEndDate: '2025-06-15' });
      await storage.set<Student[]>(STUDENTS_KEY, [student]);

      const result = await paymentService.registerPayment(
        {
          studentId: student.id,
          date: '2025-06-10', // payDate < oldEndDate, so use oldEndDate
          amount: NORMAL_PLAN.price,
          planName: NORMAL_PLAN.name,
          category: 'mensualidad',
          method: 'Efectivo',
          status: 'paid',
        },
        {
          currentSubscriptionEndDate: student.subscriptionEndDate,
          plan: NORMAL_PLAN,
        },
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      // max(2025-06-15, 2025-06-10) = 2025-06-15 + 1 month = 2025-07-15
      expect(result.data.newSubscriptionEndDate).toBe('2025-07-15');
    });

    it('should use paymentDate as base when payDate > oldEndDate', async () => {
      const student = makeStudent({ subscriptionEndDate: '2025-05-01' });
      await storage.set<Student[]>(STUDENTS_KEY, [student]);

      const result = await paymentService.registerPayment(
        {
          studentId: student.id,
          date: '2025-06-20', // payDate > oldEndDate
          amount: NORMAL_PLAN.price,
          planName: NORMAL_PLAN.name,
          category: 'mensualidad',
          method: 'Nequi',
          status: 'paid',
        },
        {
          currentSubscriptionEndDate: student.subscriptionEndDate,
          plan: NORMAL_PLAN,
        },
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      // max(2025-05-01, 2025-06-20) = 2025-06-20 + 1 month = 2025-07-20
      expect(result.data.newSubscriptionEndDate).toBe('2025-07-20');
    });

    it('should NOT extend date for single plans', async () => {
      const originalDate = '2025-06-15';
      const student = makeStudent({ subscriptionEndDate: originalDate });
      await storage.set<Student[]>(STUDENTS_KEY, [student]);

      const result = await paymentService.registerPayment(
        {
          studentId: student.id,
          date: '2025-06-20',
          amount: SINGLE_PLAN.price,
          planName: SINGLE_PLAN.name,
          category: 'mensualidad',
          method: 'Efectivo',
          status: 'paid',
        },
        {
          currentSubscriptionEndDate: student.subscriptionEndDate,
          plan: SINGLE_PLAN,
        },
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.newSubscriptionEndDate).toBe(originalDate);
    });

    it('should NOT extend date for upgrade status', async () => {
      const originalDate = '2025-06-15';
      const student = makeStudent({ subscriptionEndDate: originalDate });
      await storage.set<Student[]>(STUDENTS_KEY, [student]);

      const result = await paymentService.registerPayment(
        {
          studentId: student.id,
          date: '2025-06-20',
          amount: NORMAL_PLAN.price,
          planName: NORMAL_PLAN.name,
          category: 'mensualidad',
          method: 'Banco',
          status: 'upgrade',
        },
        {
          currentSubscriptionEndDate: student.subscriptionEndDate,
          plan: NORMAL_PLAN,
        },
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.newSubscriptionEndDate).toBe(originalDate);
    });

    it('should NOT extend date for credit status', async () => {
      const originalDate = '2025-06-15';
      const student = makeStudent({ subscriptionEndDate: originalDate });
      await storage.set<Student[]>(STUDENTS_KEY, [student]);

      const result = await paymentService.registerPayment(
        {
          studentId: student.id,
          date: '2025-06-20',
          amount: NORMAL_PLAN.price,
          planName: NORMAL_PLAN.name,
          category: 'mensualidad',
          method: 'Efectivo',
          status: 'credit',
        },
        {
          currentSubscriptionEndDate: student.subscriptionEndDate,
          plan: NORMAL_PLAN,
        },
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.newSubscriptionEndDate).toBe(originalDate);
    });

    // Property-based test con fast-check
    it('[PROPERTY] paid + non-single plan always results in date > max(oldEnd, payDate)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generar fechas aleatorias válidas (ISO strings YYYY-MM-DD)
          fc.date({
            min: new Date('2024-01-01'),
            max: new Date('2026-12-31'),
          }),
          fc.date({
            min: new Date('2024-01-01'),
            max: new Date('2026-12-31'),
          }),
          async (oldEndRaw, payDateRaw) => {
            // Limpiar storage para cada iteración
            localStorage.clear();
            resetStorageService();
            const s = await createStorageService();
            const ps = new PaymentService(s);

            const oldEnd = oldEndRaw.toISOString().split('T')[0];
            const payDate = payDateRaw.toISOString().split('T')[0];

            const student = makeStudent({ subscriptionEndDate: oldEnd });
            await s.set<Student[]>(STUDENTS_KEY, [student]);

            const result = await ps.registerPayment(
              {
                studentId: student.id,
                date: payDate,
                amount: NORMAL_PLAN.price,
                planName: NORMAL_PLAN.name,
                category: 'mensualidad',
                method: 'Efectivo',
                status: 'paid',
              },
              {
                currentSubscriptionEndDate: oldEnd,
                plan: NORMAL_PLAN,
              },
            );

            expect(result.success).toBe(true);
            if (!result.success) return;

            const newEnd = new Date(result.data.newSubscriptionEndDate!);
            const maxBase = new Date(
              Math.max(oldEndRaw.getTime(), payDateRaw.getTime()),
            );

            // La nueva fecha debe ser estrictamente mayor que max(oldEnd, payDate)
            expect(newEnd.getTime()).toBeGreaterThan(maxBase.getTime());
          },
        ),
        { numRuns: 50 },
      );
    });

    it('[PROPERTY] single plans or upgrade never change subscriptionEndDate', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({
            min: new Date('2024-01-01'),
            max: new Date('2026-12-31'),
          }),
          fc.date({
            min: new Date('2024-01-01'),
            max: new Date('2026-12-31'),
          }),
          fc.constantFrom<'paid' | 'upgrade' | 'credit'>('upgrade', 'credit'),
          async (oldEndRaw, payDateRaw, status) => {
            localStorage.clear();
            resetStorageService();
            const s = await createStorageService();
            const ps = new PaymentService(s);

            const oldEnd = oldEndRaw.toISOString().split('T')[0];
            const payDate = payDateRaw.toISOString().split('T')[0];

            const student = makeStudent({ subscriptionEndDate: oldEnd });
            await s.set<Student[]>(STUDENTS_KEY, [student]);

            const result = await ps.registerPayment(
              {
                studentId: student.id,
                date: payDate,
                amount: NORMAL_PLAN.price,
                planName: NORMAL_PLAN.name,
                category: 'mensualidad',
                method: 'Efectivo',
                status,
              },
              {
                currentSubscriptionEndDate: oldEnd,
                plan: NORMAL_PLAN,
              },
            );

            expect(result.success).toBe(true);
            if (!result.success) return;
            // La fecha no debe cambiar para upgrade o credit
            expect(result.data.newSubscriptionEndDate).toBe(oldEnd);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('[PROPERTY] single plan with paid status never changes subscriptionEndDate', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({
            min: new Date('2024-01-01'),
            max: new Date('2026-12-31'),
          }),
          fc.date({
            min: new Date('2024-01-01'),
            max: new Date('2026-12-31'),
          }),
          async (oldEndRaw, payDateRaw) => {
            localStorage.clear();
            resetStorageService();
            const s = await createStorageService();
            const ps = new PaymentService(s);

            const oldEnd = oldEndRaw.toISOString().split('T')[0];
            const payDate = payDateRaw.toISOString().split('T')[0];

            const student = makeStudent({ subscriptionEndDate: oldEnd });
            await s.set<Student[]>(STUDENTS_KEY, [student]);

            const result = await ps.registerPayment(
              {
                studentId: student.id,
                date: payDate,
                amount: SINGLE_PLAN.price,
                planName: SINGLE_PLAN.name,
                category: 'mensualidad',
                method: 'Efectivo',
                status: 'paid',
              },
              {
                currentSubscriptionEndDate: oldEnd,
                plan: SINGLE_PLAN,
              },
            );

            expect(result.success).toBe(true);
            if (!result.success) return;
            expect(result.data.newSubscriptionEndDate).toBe(oldEnd);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Property 13: Split payments validation
  // ---------------------------------------------------------------------------

  describe('Property 13: split payment validation', () => {
    it('should accept splits that sum exactly to totalAmount', async () => {
      const student = makeStudent();
      await storage.set<Student[]>(STUDENTS_KEY, [student]);

      const splits: PaymentSplit[] = [
        { method: 'Efectivo', amount: 60000 },
        { method: 'Nequi', amount: 50000 },
      ];

      // Total = 110000, splits sum = 110000
      const result = await paymentService.registerPayment({
        studentId: student.id,
        date: '2025-06-10',
        amount: NORMAL_PLAN.price,
        planName: NORMAL_PLAN.name,
        category: 'mensualidad',
        method: 'Efectivo',
        status: 'paid',
        splits,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.payment.splits).toEqual(splits);
    });

    it('should reject splits that do NOT sum to totalAmount', async () => {
      const student = makeStudent();
      await storage.set<Student[]>(STUDENTS_KEY, [student]);

      const splits: PaymentSplit[] = [
        { method: 'Efectivo', amount: 50000 },
        { method: 'Nequi', amount: 30000 },
      ];

      // Total = 110000, splits sum = 80000 (mismatch)
      const result = await paymentService.registerPayment({
        studentId: student.id,
        date: '2025-06-10',
        amount: NORMAL_PLAN.price,
        planName: NORMAL_PLAN.name,
        category: 'mensualidad',
        method: 'Efectivo',
        status: 'paid',
        splits,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/suma de los pagos divididos/);
    });

    it('should reject splits with excess over totalAmount', async () => {
      const student = makeStudent();
      await storage.set<Student[]>(STUDENTS_KEY, [student]);

      const splits: PaymentSplit[] = [
        { method: 'Efectivo', amount: 80000 },
        { method: 'Banco', amount: 50000 },
      ];

      // Total = 110000, splits sum = 130000 (excess)
      const result = await paymentService.registerPayment({
        studentId: student.id,
        date: '2025-06-10',
        amount: NORMAL_PLAN.price,
        planName: NORMAL_PLAN.name,
        category: 'mensualidad',
        method: 'Efectivo',
        status: 'paid',
        splits,
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/suma de los pagos divididos/);
    });

    // Property-based test
    it('[PROPERTY] splits are accepted if and only if their sum equals totalAmount', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generar splits aleatorios con 2-4 partes
          fc.array(
            fc.record({
              method: fc.constantFrom<'Efectivo' | 'Nequi' | 'Banco'>('Efectivo', 'Nequi', 'Banco'),
              amount: fc.integer({ min: 1000, max: 200000 }),
            }),
            { minLength: 2, maxLength: 4 },
          ),
          async (splits) => {
            localStorage.clear();
            resetStorageService();
            const s = await createStorageService();
            const ps = new PaymentService(s);

            const student = makeStudent();
            await s.set<Student[]>(STUDENTS_KEY, [student]);

            const splitsSum = splits.reduce((sum, sp) => sum + sp.amount, 0);
            const totalAmount = NORMAL_PLAN.price; // 110000

            const result = await ps.registerPayment({
              studentId: student.id,
              date: '2025-06-10',
              amount: totalAmount,
              planName: NORMAL_PLAN.name,
              category: 'mensualidad',
              method: 'Efectivo',
              status: 'paid',
              splits,
            });

            if (Math.abs(splitsSum - totalAmount) <= 0.01) {
              expect(result.success).toBe(true);
              if (!result.success) return;
              expect(result.data.payment.splits).toEqual(splits);
            } else {
              expect(result.success).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Receipt number sequence
  // ---------------------------------------------------------------------------

  describe('Receipt number sequence', () => {
    it('should generate sequential receipt numbers in GOP-XXXX format', async () => {
      const student = makeStudent();
      await storage.set<Student[]>(STUDENTS_KEY, [student]);

      const result1 = await paymentService.registerPayment({
        studentId: student.id,
        date: '2025-06-10',
        amount: NORMAL_PLAN.price,
        planName: NORMAL_PLAN.name,
        category: 'mensualidad',
        method: 'Efectivo',
        status: 'paid',
      });

      const result2 = await paymentService.registerPayment({
        studentId: student.id,
        date: '2025-07-10',
        amount: NORMAL_PLAN.price,
        planName: NORMAL_PLAN.name,
        category: 'mensualidad',
        method: 'Efectivo',
        status: 'paid',
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (!result1.success || !result2.success) return;

      expect(result1.data.receiptNo).toBe('GOP-0001');
      expect(result2.data.receiptNo).toBe('GOP-0002');
      expect(result1.data.receiptNo).not.toBe(result2.data.receiptNo);
    });

    it('should format numbers with zero-padding to 4 digits', () => {
      expect(formatReceiptNo(1)).toBe('GOP-0001');
      expect(formatReceiptNo(42)).toBe('GOP-0042');
      expect(formatReceiptNo(999)).toBe('GOP-0999');
      expect(formatReceiptNo(10000)).toBe('GOP-10000');
    });
  });

  // ---------------------------------------------------------------------------
  // Discounts
  // ---------------------------------------------------------------------------

  describe('Discounts', () => {
    it('should apply discount to the final amount', async () => {
      const student = makeStudent();
      await storage.set<Student[]>(STUDENTS_KEY, [student]);

      const result = await paymentService.registerPayment({
        studentId: student.id,
        date: '2025-06-10',
        amount: NORMAL_PLAN.price,
        planName: NORMAL_PLAN.name,
        category: 'mensualidad',
        method: 'Efectivo',
        status: 'paid',
        discount: 10000,
        discountReason: 'Pronto pago',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.payment.amount).toBe(110000);
      expect(result.data.payment.discount).toBe(10000);
      expect(result.data.payment.discountReason).toBe('Pronto pago');
    });
  });
});
