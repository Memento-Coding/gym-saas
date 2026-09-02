/**
 * Property-based tests para SaleService (Track C — Tarea 16.2).
 *
 * Valida con fast-check (numRuns: 100):
 *  - Property 21: Sale total equals sum of line subtotals
 *  - Property 22: Credit installment date spacing
 *  - Property 23: Credit with services rejection
 *  - Property 24: Credit recalculation on partial payment
 *  - Property 14: Credit installments sum to total
 *
 * Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 5.7
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// -----------------------------------------------------------------------------
// Mock del StorageService: store en memoria aislado por test.
// -----------------------------------------------------------------------------

const memoryStore = new Map<string, unknown>();

vi.mock('@/services/storage/StorageService', () => {
  const service = {
    async get<T>(key: string): Promise<T | null> {
      return memoryStore.has(key)
        ? (JSON.parse(JSON.stringify(memoryStore.get(key))) as T)
        : null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      memoryStore.set(key, JSON.parse(JSON.stringify(value)));
    },
    async delete(key: string): Promise<void> {
      memoryStore.delete(key);
    },
    async keys(): Promise<string[]> {
      return Array.from(memoryStore.keys());
    },
    async exportAll(): Promise<Record<string, unknown>> {
      return Object.fromEntries(memoryStore.entries());
    },
    async importAll(data: Record<string, unknown>): Promise<void> {
      memoryStore.clear();
      for (const [k, v] of Object.entries(data)) memoryStore.set(k, v);
    },
    async clear(): Promise<void> {
      memoryStore.clear();
    },
  };
  return {
    getStorageService: async () => service,
    createStorageService: async () => service,
    resetStorageService: () => {},
  };
});

import {
  SaleService,
  buildCreditPlan,
  remainingBalance,
  recalcInstallments,
  type SaleLineInput,
  type CreateSaleInput,
} from '@/services/SaleService';
import type { CreditPlan } from '@/types/sale';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Diferencia en días completos entre dos ISO dates (b - a), en UTC. */
function daysBetween(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.split('-').map(Number);
  const [by, bm, bd] = bIso.split('-').map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / MS_PER_DAY);
}

// -----------------------------------------------------------------------------
// Generadores
// -----------------------------------------------------------------------------

/** Línea de venta de PRODUCTO (segura para crédito). */
const productLineArb: fc.Arbitrary<SaleLineInput> = fc.record({
  inventoryId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 12 }),
  kind: fc.constant('product' as const),
  quantity: fc.integer({ min: 1, max: 20 }),
  unitPrice: fc.integer({ min: 100, max: 500_000 }),
});

/** Línea de venta de SERVICIO. */
const serviceLineArb: fc.Arbitrary<SaleLineInput> = fc.record({
  inventoryId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 12 }),
  kind: fc.constant('service' as const),
  quantity: fc.integer({ min: 1, max: 20 }),
  unitPrice: fc.integer({ min: 100, max: 500_000 }),
});

/** Línea de cualquier tipo. */
const anyLineArb: fc.Arbitrary<SaleLineInput> = fc.oneof(productLineArb, serviceLineArb);

const isoDateArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 2024, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------

let service: SaleService;

beforeEach(() => {
  memoryStore.clear();
  service = new SaleService();
});

describe('SaleService — Property-based tests', () => {
  // Feature: meraki-web-app, Property 21: Sale total equals sum of line subtotals
  it('Property 21: el total de la venta es la suma de (quantity * unitPrice) por línea', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(productLineArb, { minLength: 1, maxLength: 8 }),
        async (lines) => {
          memoryStore.clear();
          const input: CreateSaleInput = {
            clientType: 'external',
            clientName: 'Cliente',
            items: lines,
            type: 'cash',
            method: 'Efectivo',
          };
          const result = await service.createSale(input);
          expect(result.success).toBe(true);
          if (result.success) {
            const expected = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
            expect(result.data.total).toBe(expected);
            // Cada subtotal de línea también debe cuadrar.
            for (let i = 0; i < lines.length; i++) {
              expect(result.data.items[i].subtotal).toBe(lines[i].quantity * lines[i].unitPrice);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: meraki-web-app, Property 22: Credit installment date spacing
  it('Property 22: single genera 1 cuota; three_installments genera 3 cuotas separadas 15 días', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 5_000_000 }), // total
        fc.integer({ min: 0, max: 1_000_000 }), // abono inicial (acotado abajo)
        isoDateArb,
        fc.boolean(), // single o three
        (total, rawInitial, startDate, isSingle) => {
          const initialPayment = Math.min(rawInitial, total);

          if (isSingle) {
            const plan = buildCreditPlan(total, initialPayment, {
              type: 'single',
              singleDueDate: startDate,
            });
            expect(plan.installments).toHaveLength(1);
            expect(plan.installments[0].dueDate).toBe(startDate);
          } else {
            const plan = buildCreditPlan(total, initialPayment, {
              type: 'three_installments',
              startDate,
            });
            expect(plan.installments).toHaveLength(3);
            // 15 días entre cuotas consecutivas.
            expect(daysBetween(plan.installments[0].dueDate, plan.installments[1].dueDate)).toBe(15);
            expect(daysBetween(plan.installments[1].dueDate, plan.installments[2].dueDate)).toBe(15);
            // La primera cuota arranca en startDate.
            expect(plan.installments[0].dueDate).toBe(startDate);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: meraki-web-app, Property 23: Credit with services rejection
  it('Property 23: una venta a crédito con al menos un servicio es rechazada', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(anyLineArb, { minLength: 1, maxLength: 8 }),
        async (lines) => {
          memoryStore.clear();
          const hasService = lines.some((l) => l.kind === 'service');

          const result = await service.createSale({
            clientType: 'external',
            clientName: 'Cliente',
            items: lines,
            type: 'credit',
            credit: { type: 'single', singleDueDate: '2025-01-01' },
          });

          if (hasService) {
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toMatch(/crédito solo aplica para productos/i);
            }
          } else {
            expect(result.success).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: meraki-web-app, Property 24: Credit recalculation on partial payment
  it('Property 24: al pagar una cuota, el saldo restante baja exactamente en el monto pagado', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 300, max: 5_000_000 }), // total
        fc.integer({ min: 100, max: 3_000_000 }), // amountPaid
        (total, amountPaid) => {
          const plan = buildCreditPlan(total, 0, {
            type: 'three_installments',
            startDate: '2025-01-01',
          });

          const balanceBefore = remainingBalance(plan);
          expect(balanceBefore).toBe(total); // sin abono inicial, saldo = total

          const updated = recalcInstallments(plan, 1, amountPaid, '2025-01-05');
          const balanceAfter = remainingBalance(updated);

          // El saldo restante debe disminuir exactamente en amountPaid.
          expect(balanceAfter).toBe(balanceBefore - amountPaid);
          // La cuota pagada queda marcada.
          expect(updated.installments[0].paid).toBe(true);
          expect(updated.installments[0].paidAmount).toBe(amountPaid);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: meraki-web-app, Property 14: Credit installments sum to total
  it('Property 14: la suma de las cuotas generadas es igual a (Total - Abono inicial)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000_000 }), // total
        fc.integer({ min: 0, max: 5_000_000 }), // abono inicial crudo
        fc.constantFrom('single', 'three_installments') as fc.Arbitrary<
          'single' | 'three_installments'
        >,
        (total, rawInitial, type) => {
          const initialPayment = Math.min(rawInitial, total);
          const plan: CreditPlan = buildCreditPlan(total, initialPayment, {
            type,
            singleDueDate: '2025-01-01',
            startDate: '2025-01-01',
          });

          const sumInstallments = plan.installments.reduce((acc, i) => acc + i.amount, 0);
          // Sin pérdida por redondeo: la suma es exactamente T - P.
          expect(sumInstallments).toBe(total - initialPayment);
        },
      ),
      { numRuns: 100 },
    );
  });
});
