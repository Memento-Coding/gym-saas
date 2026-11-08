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
  DOCUMENT_TYPES,
  birthDateSchema,
  copAmount,
  documentFormatError,
  emailSchema,
  formatDocument,
  isoDateSchema,
  passwordSchema,
  personNameSchema,
  phoneSchema,
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

describe('documentFormatError: documentos colombianos', () => {
  const valid = (v: string, t?: Parameters<typeof documentFormatError>[1]) =>
    documentFormatError(v, t) === null;

  it('CC: 4 a 10 dígitos sin ceros a la izquierda', () => {
    expect(valid('1234', 'CC')).toBe(true);
    expect(valid('1002003004', 'CC')).toBe(true);
    expect(valid('123', 'CC')).toBe(false);
    expect(valid('12345678901', 'CC')).toBe(false);
    expect(valid('0123456', 'CC')).toBe(false);
  });

  it('TI: 10 u 11 dígitos; PEP: exactamente 15', () => {
    expect(valid('1012345678', 'TI')).toBe(true);
    expect(valid('10123456789', 'TI')).toBe(true);
    expect(valid('123456789', 'TI')).toBe(false);
    expect(valid('123456789012345', 'PEP')).toBe(true);
    expect(valid('12345678901234', 'PEP')).toBe(false);
  });

  it('PA admite letras (sin importar mayúsculas); los numéricos no', () => {
    expect(valid('at123456', 'PA')).toBe(true);
    expect(valid('AT-123456', 'PA')).toBe(false);
    expect(valid('AT123456', 'CC')).toBe(false);
  });

  it('distingue el mensaje de caracteres del de longitud', () => {
    expect(documentFormatError('12A4')).toBe(messages.onlyDigits('El documento'));
    expect(documentFormatError('123', 'CC')).toMatch(/CC: debe tener 4 a 10 dígitos/);
  });

  it('property: ningún tipo numérico acepta un valor con letras', () => {
    const numeric = DOCUMENT_TYPES.filter((t) => t.value !== 'PA');
    fc.assert(
      fc.property(
        fc.constantFrom(...numeric.map((t) => t.value)),
        fc.string({ minLength: 1 }).filter((s) => /[^\d\s]/.test(s)),
        (type, s) => documentFormatError(s, type) !== null,
      ),
    );
  });

  it('formatDocument antepone el tipo solo si existe', () => {
    expect(formatDocument('123456', 'CC')).toBe('CC 123456');
    expect(formatDocument('123456')).toBe('123456');
    expect(formatDocument('', 'CC')).toBe('');
  });
});

describe('phoneSchema / emailSchema / personNameSchema / passwordSchema', () => {
  it('acepta celulares y fijos colombianos y normaliza a 10 dígitos', () => {
    expect(phoneSchema().parse('300 123 4567')).toBe('3001234567');
    expect(phoneSchema().parse('+57 300-123-4567')).toBe('3001234567');
    expect(phoneSchema().parse('6014567890')).toBe('6014567890');
    expect(phoneSchema().parse('')).toBe('');
  });

  it('rechaza números que no existen en Colombia', () => {
    for (const bad of ['1234567', '2001234567', '30012345678', '30012abc67']) {
      expect(phoneSchema().safeParse(bad).success).toBe(false);
    }
  });

  it('un obligatorio en blanco reporta "es obligatorio"', () => {
    const r = phoneSchema('El teléfono', true).safeParse('');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe(messages.required('El teléfono'));
    const e = emailSchema('El email', true).safeParse('   ');
    if (!e.success) expect(e.error.issues[0].message).toBe(messages.required('El email'));
    expect(e.success).toBe(false);
  });

  it('nombres: tildes, ñ y apóstrofos sí; números y símbolos no', () => {
    for (const ok of ['María José', 'Ñuñez', "D'Angelo", 'Pérez-Gómez']) {
      expect(personNameSchema().safeParse(ok).success).toBe(true);
    }
    for (const bad of ['Ana2', 'A', '<script>', '@@']) {
      expect(personNameSchema().safeParse(bad).success).toBe(false);
    }
  });

  it('contraseña: misma política de Cognito', () => {
    expect(passwordSchema().safeParse('Abcdefg1').success).toBe(true);
    for (const bad of ['Abc1', 'abcdefg1', 'ABCDEFG1', 'Abcdefgh']) {
      expect(passwordSchema().safeParse(bad).success).toBe(false);
    }
  });
});

describe('copAmount / enteros estrictos', () => {
  it('acepta enteros en pesos', () => {
    expect(copAmount().parse('110000')).toBe(110000);
    expect(copAmount().parse(0)).toBe(0);
  });

  it('rechaza decimales, notación científica, hexadecimal y separadores', () => {
    for (const bad of ['99.99', '1e3', '0x10', '110.000', 'abc', 1.5, Number.NaN]) {
      expect(copAmount().safeParse(bad).success).toBe(false);
    }
  });

  it('el vacío es error si es obligatorio y undefined si es opcional', () => {
    const r = copAmount('El costo').safeParse('');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe(messages.required('El costo'));
    expect(copAmount('El costo', false).parse('')).toBeUndefined();
  });

  it('positiveInteger respeta su tope (cortesías: 52 semanas)', () => {
    expect(positiveInteger('La duración', 52).safeParse('52').success).toBe(true);
    expect(positiveInteger('La duración', 52).safeParse('53').success).toBe(false);
  });

  it('integerInRange no convierte el vacío en 0', () => {
    expect(integerInRange('El stock', 0, 10).safeParse('').success).toBe(false);
    expect(integerInRange('El stock', 0, 10).safeParse('1e1').success).toBe(false);
    expect(integerInRange('El stock', 0, 10).parse('0')).toBe(0);
  });
});

describe('birthDateSchema / isoDateSchema', () => {
  it('rechaza nacimientos futuros o imposibles', () => {
    expect(birthDateSchema().safeParse('2999-01-01').success).toBe(false);
    expect(birthDateSchema().safeParse('1800-01-01').success).toBe(false);
    expect(birthDateSchema().safeParse('2000-05-10').success).toBe(true);
    expect(birthDateSchema().safeParse('').success).toBe(true);
  });

  it('atrapa años mal digitados', () => {
    expect(isoDateSchema().safeParse('0202-01-01').success).toBe(false);
    expect(isoDateSchema().safeParse('2024-01-01').success).toBe(true);
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
