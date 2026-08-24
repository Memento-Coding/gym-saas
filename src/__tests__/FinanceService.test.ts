/**
 * Property-based tests para FinanceService (Track D — Dev 4, Task 19.2).
 *
 * Valida las propiedades de correctitud 17, 18 y 19 definidas en el design.md
 * del spec meraki-web-app usando fast-check con un mínimo de 100 iteraciones
 * por propiedad.
 *
 * Validates: Requirements 7.3, 7.5, 7.7
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

import { FinanceService } from '@/services/FinanceService';
import type { FinanceBox, TransferInput } from '@/services/FinanceService';
import type { StorageService } from '@/services/storage/StorageService';
import type { FinanceMovement } from '@/types/finance';
import type { PaymentMethod } from '@/types/payment';

// =============================================================================
// StorageService en memoria para aislar la lógica de FinanceService
// =============================================================================

function createInMemoryStorage(): StorageService {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | null> {
      return (store.has(key) ? (store.get(key) as T) : null);
    },
    async set<T>(key: string, value: T): Promise<void> {
      // Clonar para evitar aliasing con las estructuras internas del test
      store.set(key, JSON.parse(JSON.stringify(value)));
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async keys(): Promise<string[]> {
      return Array.from(store.keys());
    },
    async exportAll(): Promise<Record<string, unknown>> {
      return Object.fromEntries(store.entries());
    },
    async importAll(data: Record<string, unknown>): Promise<void> {
      store.clear();
      for (const [k, v] of Object.entries(data)) store.set(k, v);
    },
    async clear(preserveKeys?: string[]): Promise<void> {
      for (const k of Array.from(store.keys())) {
        if (!preserveKeys?.includes(k)) store.delete(k);
      }
    },
  };
}

// =============================================================================
// Generadores personalizados
// =============================================================================

const boxArb: fc.Arbitrary<FinanceBox> = fc.constantFrom('servicios', 'almacen');

const methodArb: fc.Arbitrary<PaymentMethod> = fc.constantFrom('Efectivo', 'Nequi', 'Banco');

/**
 * Genera una fecha ISO acotada a los años 2023-2026 para que el mes ('YYYY-MM')
 * sea variado y estable. Usa el mediodía UTC para evitar corrimientos.
 */
const isoDateArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 2023, max: 2026 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ year, month, day }) => {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}T12:00:00.000Z`;
  });

/**
 * Generador de movimientos financieros válidos (income | expense | transfer).
 * Los montos son enteros positivos (centavos/pesos) para evitar imprecisión de
 * punto flotante en las comparaciones de balance.
 */
const financeMovementArb: fc.Arbitrary<FinanceMovement> = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom('income', 'expense', 'transfer') as fc.Arbitrary<
    FinanceMovement['type']
  >,
  date: isoDateArb,
  concept: fc.string(),
  category: fc.string(),
  amount: fc.integer({ min: 1, max: 5_000_000 }),
  box: boxArb,
  method: fc.option(methodArb, { nil: undefined }),
});

/** Generador de un input de traslado válido */
const transferInputArb: fc.Arbitrary<TransferInput> = fc.record({
  date: isoDateArb,
  amount: fc.integer({ min: 1, max: 5_000_000 }),
  fromBox: boxArb,
  toBox: boxArb,
  fromMethod: fc.option(methodArb, { nil: undefined }),
  toMethod: fc.option(methodArb, { nil: undefined }),
});

// =============================================================================
// Tests
// =============================================================================

describe('FinanceService — Property-based tests', () => {
  let storage: StorageService;
  let service: FinanceService;

  beforeEach(() => {
    storage = createInMemoryStorage();
    service = new FinanceService(storage);
  });

  // Feature: meraki-web-app, Property 17: Finance balance invariant
  it('Property 17: el balance es sum(ingresos) - sum(egresos) y los traslados son neutros', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(financeMovementArb), async (movements) => {
        const expected = movements.reduce((acc, m) => {
          if (m.type === 'income') return acc + m.amount;
          if (m.type === 'expense') return acc - m.amount;
          return acc; // transfer no afecta
        }, 0);

        expect(FinanceService.computeBalance(movements)).toBe(expected);

        // Los traslados no deben cambiar el balance respecto de solo income/expense
        const withoutTransfers = movements.filter((m) => m.type !== 'transfer');
        expect(FinanceService.computeBalance(movements)).toBe(
          FinanceService.computeBalance(withoutTransfers),
        );

        // El balance calculado desde el almacenamiento coincide con el esperado
        const localStorage = createInMemoryStorage();
        await localStorage.set('finance_movements', movements);
        const localService = new FinanceService(localStorage);
        expect(await localService.getBalance()).toBe(expected);
      }),
      { numRuns: 100 },
    );

    // El servicio inicializado en beforeEach reporta balance 0 sin movimientos
    expect(await service.getBalance()).toBe(0);
  });

  // Feature: meraki-web-app, Property 18: Finance filter correctness
  it('Property 18: el filtro por mes y caja retorna exactamente los movimientos que coinciden', () => {
    fc.assert(
      fc.property(
        fc.array(financeMovementArb),
        fc.option(fc.constantFrom(...['2023', '2024', '2025', '2026']), { nil: undefined }),
        fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
        fc.option(boxArb, { nil: undefined }),
        (movements, year, monthNum, box) => {
          const month =
            year !== undefined && monthNum !== undefined
              ? `${year}-${String(monthNum).padStart(2, '0')}`
              : undefined;

          const result = FinanceService.applyFilter(movements, { month, box });

          // Correctitud: todo resultado satisface los criterios
          for (const m of result) {
            if (month !== undefined) expect(m.date.slice(0, 7)).toBe(month);
            if (box !== undefined) expect(m.box).toBe(box);
          }

          // Completitud: ningún movimiento que coincida queda excluido
          const matching = movements.filter((m) => {
            if (month !== undefined && m.date.slice(0, 7) !== month) return false;
            if (box !== undefined && m.box !== box) return false;
            return true;
          });
          expect(result.length).toBe(matching.length);
          expect(result).toEqual(matching);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: meraki-web-app, Property 19: Transfer creates balanced movements
  it('Property 19: un traslado crea débito y crédito iguales con efecto neto cero', async () => {
    await fc.assert(
      fc.asyncProperty(transferInputArb, async (input) => {
        const localStorage = createInMemoryStorage();
        const localService = new FinanceService(localStorage);

        const balanceBefore = await localService.getBalance();

        const [debit, credit] = await localService.transfer(input);

        // Se crean exactamente dos movimientos asociados
        expect(debit.transferTo).toBe(credit.id);
        expect(credit.transferTo).toBe(debit.id);

        // Montos iguales
        expect(debit.amount).toBe(input.amount);
        expect(credit.amount).toBe(input.amount);
        expect(debit.amount).toBe(credit.amount);

        // Origen y destino correctos
        expect(debit.box).toBe(input.fromBox);
        expect(credit.box).toBe(input.toBox);

        // Efecto neto cero sobre el balance global
        const balanceAfter = await localService.getBalance();
        expect(balanceAfter).toBe(balanceBefore);

        // Ambos movimientos existen en el almacenamiento
        const all = await localService.getAll();
        expect(all).toHaveLength(2);
      }),
      { numRuns: 100 },
    );
  });
});
