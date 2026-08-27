/**
 * Property-based tests para PaymentService (Track B — Tarea 11.2).
 *
 * Valida con fast-check (numRuns: 100):
 *  - Property 12: Subscription date extension correctness
 *  - Property 13: Split payment sum validation
 *
 * Validates: Requirements 4.5, 5.1, 5.2, 5.6
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  computeSubscriptionEndDate,
  validateSplits,
} from '@/services/PaymentService';
import type { PaymentSplit, PaymentMethod } from '@/types/payment';

// -----------------------------------------------------------------------------
// Oráculo independiente para la aritmética de fechas (UTC), replicando el spec.
// -----------------------------------------------------------------------------

function parseUTC(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addOneMonthOracle(date: Date): Date {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

// -----------------------------------------------------------------------------
// Generadores
// -----------------------------------------------------------------------------

/** Genera una fecha ISO YYYY-MM-DD válida (días 1..28 para evitar ambigüedad). */
const isoDateArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );

const methodArb: fc.Arbitrary<PaymentMethod> = fc.constantFrom('Efectivo', 'Nequi', 'Banco');

// =============================================================================
// Property 12
// =============================================================================

describe('PaymentService — Property-based tests', () => {
  // Feature: meraki-web-app, Property 12: Subscription date extension correctness
  it('Property 12: extensión de vencimiento correcta según status y plan single', () => {
    fc.assert(
      fc.property(
        isoDateArb, // oldEndDate
        isoDateArb, // paymentDate
        fc.constantFrom('paid', 'upgrade', 'credit') as fc.Arbitrary<
          'paid' | 'upgrade' | 'credit'
        >,
        fc.boolean(), // plan.single
        (oldEnd, payDate, status, single) => {
          const result = computeSubscriptionEndDate(oldEnd, payDate, status, { single });

          if (status === 'paid' && !single) {
            // Debe ser max(oldEnd, payDate) + 1 mes.
            const oldD = parseUTC(oldEnd);
            const payD = parseUTC(payDate);
            const base = oldD.getTime() >= payD.getTime() ? oldD : payD;
            const expected = toIsoUTC(addOneMonthOracle(base));
            expect(result).toBe(expected);
          } else {
            // upgrade o single → sin cambio.
            expect(result).toBe(oldEnd);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: meraki-web-app, Property 13: Split payment sum validation
  it('Property 13: los splits se aceptan si y solo si su suma iguala el monto neto', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }), // amount
        fc.integer({ min: 0, max: 1_000_000 }), // discount
        fc.array(
          fc.record({ method: methodArb, amount: fc.integer({ min: 0, max: 5_000_000 }) }),
          { minLength: 1, maxLength: 4 },
        ),
        fc.boolean(), // forceValid: forzar que la suma cuadre exactamente
        (amount, discount, rawSplits, forceValid) => {
          const net = amount - discount;
          let splits: PaymentSplit[] = rawSplits;

          if (forceValid) {
            // Ajustamos el último split para que la suma iguale el neto.
            const partial = rawSplits
              .slice(0, -1)
              .reduce((acc, s) => acc + s.amount, 0);
            const last = net - partial;
            splits = [...rawSplits.slice(0, -1), { method: rawSplits[rawSplits.length - 1].method, amount: last }];
          }

          const sum = splits.reduce((acc, s) => acc + s.amount, 0);
          const result = validateSplits(amount, splits, discount);

          if (sum === net) {
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toBe(net);
          } else {
            expect(result.success).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Complemento de Property 13: sin splits → válido (pago simple).
  it('Property 13 (sin splits): un pago sin splits siempre es válido y devuelve el neto', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (amount, discount) => {
          const result = validateSplits(amount, undefined, discount);
          expect(result.success).toBe(true);
          if (result.success) expect(result.data).toBe(amount - discount);
        },
      ),
      { numRuns: 100 },
    );
  });
});
