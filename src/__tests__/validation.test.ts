/**
 * validation.test.ts — Cobertura del catálogo de validaciones (GymOps)
 * =============================================================================
 *
 * Unit tests + property-based tests (fast-check) para `src/utils/validation.ts`.
 *
 * Cubre (STEERING_FORMS §8):
 *  - Unit: rechazo de caracteres inválidos, límites numéricos, porcentajes,
 *    cálculo correcto de fechas de vencimiento e integridad cronológica.
 *  - Integration: flujo de creación simulando validación de duplicados contra
 *    StorageService, y consumo correcto de catálogos (selects contra origen).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

import {
  createStorageService,
  resetStorageService,
} from '@/services/storage/StorageService';
import type { StorageService } from '@/services/storage/StorageService';
import type { Student } from '@/types/student';
import type { MembershipPlan } from '@/types/membership';

import {
  documentSchema,
  isValidDocumentFormat,
  isDocumentUniqueIn,
  isDocumentUnique,
  nonNegativeAmount,
  isValidAmount,
  integerInRange,
  positiveInteger,
  percentage,
  isValidIsoDate,
  parseIsoDateUTC,
  toIsoDateUTC,
  addOneMonthUTC,
  isChronological,
  dateRangeSchema,
  computeSubscriptionEndDate,
  isInSource,
  selectFromSource,
  messages,
} from '@/utils/validation';

// -----------------------------------------------------------------------------
// Helpers de test
// -----------------------------------------------------------------------------

/** Construye un Student mínimo para pruebas de unicidad. */
function makeStudent(id: string, documentId: string): Pick<Student, 'id' | 'documentId'> {
  return { id, documentId };
}

const PLANS: MembershipPlan[] = [
  { id: 'plan-mensual', name: 'Mensualidad', price: 110000 },
  { id: 'plan-single', name: 'Clase única', price: 20000, single: true },
  { id: 'plan-trimestral', name: 'Trimestral', price: 300000 },
];

// =============================================================================
// UNIT — Documentos: rechazo de caracteres inválidos
// =============================================================================

describe('documentSchema / isValidDocumentFormat', () => {
  it('acepta documentos de solo dígitos (4–20)', () => {
    expect(documentSchema().safeParse('1234').success).toBe(true);
    expect(documentSchema().safeParse('1002003004').success).toBe(true);
    expect(isValidDocumentFormat('987654321')).toBe(true);
  });

  it('rechaza letras y caracteres especiales', () => {
    for (const bad of ['12A45', 'abc', '12.34', '12-34', '12 34', '++', '']) {
      expect(documentSchema().safeParse(bad).success).toBe(false);
      expect(isValidDocumentFormat(bad)).toBe(false);
    }
  });

  it('rechaza documentos demasiado cortos o largos', () => {
    expect(isValidDocumentFormat('123')).toBe(false); // < 4
    expect(isValidDocumentFormat('1'.repeat(21))).toBe(false); // > 20
  });

  it('property: cualquier string con no-dígitos es rechazado', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => /\D/.test(s)),
        (s) => isValidDocumentFormat(s) === false,
      ),
    );
  });

  it('property: cualquier cadena de dígitos de longitud [4,20] es aceptada', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.integer({ min: 0, max: 9 }), { minLength: 4, maxLength: 20 })
          .map((arr) => arr.join('')),
        (digits) => isValidDocumentFormat(digits) === true,
      ),
    );
  });
});

// =============================================================================
// UNIT — Montos monetarios: no negativos + límites
// =============================================================================

describe('nonNegativeAmount / isValidAmount', () => {
  it('acepta montos válidos (incluye 0 y decimales)', () => {
    expect(nonNegativeAmount().safeParse(0).success).toBe(true);
    expect(nonNegativeAmount().safeParse(110000).success).toBe(true);
    expect(nonNegativeAmount().safeParse('99.99').success).toBe(true); // coerción
  });

  it('rechaza negativos con el mensaje estandarizado', () => {
    const r = nonNegativeAmount('El monto').safeParse(-1);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(messages.negative('El monto'));
    }
  });

  it('rechaza valores no numéricos y por encima del máximo', () => {
    expect(nonNegativeAmount().safeParse('abc').success).toBe(false);
    expect(nonNegativeAmount('El monto', 1000).safeParse(1001).success).toBe(false);
  });

  it('property: ningún número negativo es aceptado', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(-1e6), max: Math.fround(-0.01), noNaN: true }),
        (n) => nonNegativeAmount().safeParse(n).success === false,
      ),
    );
  });

  it('property: todo número finito en [0, max] es aceptado', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(10_000_000), noNaN: true }),
        (n) => nonNegativeAmount().safeParse(n).success === isValidAmount(n),
      ),
    );
  });
});

// =============================================================================
// UNIT — Enteros y porcentajes: límites
// =============================================================================

describe('integerInRange / positiveInteger / percentage', () => {
  it('positiveInteger acepta enteros [1, max] y rechaza decimales/0/negativos', () => {
    expect(positiveInteger('Clases').safeParse(1).success).toBe(true);
    expect(positiveInteger('Clases').safeParse(12).success).toBe(true);
    expect(positiveInteger('Clases').safeParse(0).success).toBe(false);
    expect(positiveInteger('Clases').safeParse(-3).success).toBe(false);
    expect(positiveInteger('Clases').safeParse(2.5).success).toBe(false);
  });

  it('integerInRange respeta límites inclusivos', () => {
    const s = integerInRange('Edad', 5, 10);
    expect(s.safeParse(5).success).toBe(true);
    expect(s.safeParse(10).success).toBe(true);
    expect(s.safeParse(4).success).toBe(false);
    expect(s.safeParse(11).success).toBe(false);
  });

  it('percentage acota a [0, 100]', () => {
    expect(percentage().safeParse(0).success).toBe(true);
    expect(percentage().safeParse(100).success).toBe(true);
    expect(percentage().safeParse(100.01).success).toBe(false);
    expect(percentage().safeParse(-1).success).toBe(false);
  });

  it('property: percentage acepta exactamente los valores en [0,100]', () => {
    fc.assert(
      fc.property(fc.float({ min: Math.fround(-50), max: Math.fround(150), noNaN: true }), (n) => {
        const expected = n >= 0 && n <= 100;
        return percentage().safeParse(n).success === expected;
      }),
    );
  });

  it('property: integerInRange nunca acepta un no-entero', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true }).filter((n) => !Number.isInteger(n)),
        (n) => integerInRange('X', -1e6, 1e6).safeParse(n).success === false,
      ),
    );
  });
});

// =============================================================================
// UNIT — Fechas: helpers UTC, validez e integridad cronológica
// =============================================================================

describe('fechas: parseo, validez y cronología', () => {
  it('isValidIsoDate acepta fechas reales y rechaza imposibles', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true); // bisiesto
    expect(isValidIsoDate('2023-02-29')).toBe(false); // no bisiesto
    expect(isValidIsoDate('2024-02-31')).toBe(false);
    expect(isValidIsoDate('2024-13-01')).toBe(false);
    expect(isValidIsoDate('hoy')).toBe(false);
  });

  it('parseo/formato UTC hace round-trip', () => {
    expect(toIsoDateUTC(parseIsoDateUTC('2024-06-15'))).toBe('2024-06-15');
  });

  it('addOneMonthUTC aplica clamping al último día del mes destino', () => {
    expect(toIsoDateUTC(addOneMonthUTC(parseIsoDateUTC('2024-01-31')))).toBe('2024-02-29');
    expect(toIsoDateUTC(addOneMonthUTC(parseIsoDateUTC('2023-01-31')))).toBe('2023-02-28');
    expect(toIsoDateUTC(addOneMonthUTC(parseIsoDateUTC('2024-03-15')))).toBe('2024-04-15');
  });

  it('isChronological / dateRangeSchema exigen fin >= inicio', () => {
    expect(isChronological('2024-01-01', '2024-01-01')).toBe(true);
    expect(isChronological('2024-01-01', '2023-12-31')).toBe(false);

    const schema = dateRangeSchema('start', 'end');
    expect(schema.safeParse({ start: '2024-01-01', end: '2024-02-01' }).success).toBe(true);
    const bad = schema.safeParse({ start: '2024-02-01', end: '2024-01-01' });
    expect(bad.success).toBe(false);
  });

  it('property: round-trip UTC estable para fechas arbitrarias', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1970-01-01'), max: new Date('2100-12-31'), noInvalidDate: true }),
        (d) => {
          const iso = toIsoDateUTC(d);
          return toIsoDateUTC(parseIsoDateUTC(iso)) === iso;
        },
      ),
    );
  });
});

// =============================================================================
// UNIT — Cálculo de fecha de vencimiento
// =============================================================================

describe('computeSubscriptionEndDate', () => {
  const mensual = PLANS[0];
  const single = PLANS[1];

  it('paid + plan no-single extiende un mes desde el máximo(oldEnd, payDate)', () => {
    // payDate posterior al vencimiento previo → base = payDate.
    expect(computeSubscriptionEndDate('2024-01-10', '2024-02-05', 'paid', mensual)).toBe(
      '2024-03-05',
    );
    // oldEnd posterior a payDate → base = oldEnd (renovación anticipada).
    expect(computeSubscriptionEndDate('2024-03-20', '2024-03-01', 'paid', mensual)).toBe(
      '2024-04-20',
    );
  });

  it('plan single NO extiende el vencimiento', () => {
    expect(computeSubscriptionEndDate('2024-01-10', '2024-02-05', 'paid', single)).toBe(
      '2024-01-10',
    );
  });

  it('upgrade y credit NO extienden el vencimiento', () => {
    expect(computeSubscriptionEndDate('2024-01-10', '2024-02-05', 'upgrade', mensual)).toBe(
      '2024-01-10',
    );
    expect(computeSubscriptionEndDate('2024-01-10', '2024-02-05', 'credit', mensual)).toBe(
      '2024-01-10',
    );
  });

  it('property: paid no-single siempre produce un vencimiento >= payDate', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }),
        (a, b) => {
          const oldEnd = toIsoDateUTC(a);
          const payDate = toIsoDateUTC(b);
          const result = computeSubscriptionEndDate(oldEnd, payDate, 'paid', mensual);
          return parseIsoDateUTC(result).getTime() > parseIsoDateUTC(payDate).getTime();
        },
      ),
    );
  });
});

// =============================================================================
// UNIT — Selects contra el catálogo de origen
// =============================================================================

describe('isInSource / selectFromSource', () => {
  it('acepta un id presente en el catálogo', () => {
    expect(isInSource('plan-mensual', PLANS, (p) => p.id)).toBe(true);
    expect(selectFromSource(PLANS).safeParse('plan-single').success).toBe(true);
  });

  it('rechaza un valor inexistente (ej. plan eliminado) o vacío', () => {
    expect(isInSource('plan-fantasma', PLANS, (p) => p.id)).toBe(false);
    const r = selectFromSource(PLANS, (p) => p.id, 'El plan').safeParse('plan-fantasma');
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(messages.notInCatalog('El plan'));
    }
    expect(selectFromSource(PLANS).safeParse('').success).toBe(false);
  });

  it('property: selectFromSource acepta exactamente las claves del origen', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const expected = PLANS.some((p) => p.id === value) && value.trim().length > 0;
        return selectFromSource(PLANS).safeParse(value).success === expected;
      }),
    );
  });
});

// =============================================================================
// UNIT — Unicidad de documento (puro, sin I/O)
// =============================================================================

describe('isDocumentUniqueIn', () => {
  const students = [makeStudent('a', '111'), makeStudent('b', '222')];

  it('detecta duplicados', () => {
    expect(isDocumentUniqueIn('111', students)).toBe(false);
    expect(isDocumentUniqueIn('333', students)).toBe(true);
  });

  it('excluye el propio id en modo edición', () => {
    // El estudiante "a" mantiene su propio documento: no cuenta como duplicado.
    expect(isDocumentUniqueIn('111', students, 'a')).toBe(true);
    // Pero no puede tomar el de otro.
    expect(isDocumentUniqueIn('222', students, 'a')).toBe(false);
  });
});

// =============================================================================
// INTEGRATION — Flujo de creación con validación de duplicados vs StorageService
// =============================================================================

describe('integración: isDocumentUnique contra StorageService', () => {
  let storage: StorageService;

  beforeEach(async () => {
    localStorage.clear();
    resetStorageService();
    storage = await createStorageService();
  });

  afterEach(() => {
    localStorage.clear();
    resetStorageService();
  });

  it('un documento nuevo pasa la validación de unicidad', async () => {
    await storage.set<Pick<Student, 'id' | 'documentId'>[]>('students', [
      makeStudent('s1', '1001'),
    ]);

    const result = await isDocumentUnique('2002', storage);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('2002');
  });

  it('un documento ya registrado es rechazado (simulación backend)', async () => {
    await storage.set<Pick<Student, 'id' | 'documentId'>[]>('students', [
      makeStudent('s1', '1001'),
    ]);

    const result = await isDocumentUnique('1001', storage);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(messages.duplicate('El documento'));
    }
  });

  it('en edición, el propio documento del estudiante no colisiona consigo mismo', async () => {
    await storage.set<Pick<Student, 'id' | 'documentId'>[]>('students', [
      makeStudent('s1', '1001'),
      makeStudent('s2', '2002'),
    ]);

    // s1 conserva su documento.
    const ok = await isDocumentUnique('1001', storage, 's1');
    expect(ok.success).toBe(true);

    // s1 intenta tomar el documento de s2 → rechazado.
    const clash = await isDocumentUnique('2002', storage, 's1');
    expect(clash.success).toBe(false);
  });

  it('rechaza documentos con formato inválido antes de consultar el catálogo', async () => {
    const result = await isDocumentUnique('12A4', storage);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(messages.onlyDigits('El documento'));
    }
  });

  it('colección vacía: cualquier documento válido es único', async () => {
    const result = await isDocumentUnique('9999', storage);
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// INTEGRATION — Consumo de catálogo de planes en un flujo de select
// =============================================================================

describe('integración: catálogo de planes cargado desde StorageService', () => {
  let storage: StorageService;

  beforeEach(async () => {
    localStorage.clear();
    resetStorageService();
    storage = await createStorageService();
  });

  afterEach(() => {
    localStorage.clear();
    resetStorageService();
  });

  it('valida el plan seleccionado contra el catálogo real persistido', async () => {
    await storage.set<{ memberships: MembershipPlan[] }>('costs', { memberships: PLANS });

    const costs = (await storage.get<{ memberships: MembershipPlan[] }>('costs'))!;
    const planSelect = selectFromSource(costs.memberships, (p) => p.id, 'El plan');

    expect(planSelect.safeParse('plan-mensual').success).toBe(true);
    expect(planSelect.safeParse('plan-inexistente').success).toBe(false);
  });
});
