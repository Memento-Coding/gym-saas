/**
 * StudentService.search.test.ts — Cobertura del método search (Req 3.6).
 *
 * Valida los cuatro escenarios del reporte de QA:
 *  1. Nombre completo ("Gustavo Luna") — el bug original.
 *  2. Búsqueda por planName — campo que faltaba en el haystack.
 *  3. Documento (cédula) — coincidencias parciales y totales.
 *  4. Teléfono — coincidencias parciales y totales.
 *
 * Además cubre: término vacío devuelve todos, insensibilidad a mayúsculas,
 * espacios extra en el query, y sin coincidencia devuelve vacío.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StudentService } from './StudentService';
import { createStorageService, resetStorageService } from './storage/StorageService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TODAY = '2026-08-30';

function base(overrides: Partial<{
  id: string;
  firstName: string;
  lastName: string;
  documentId: string;
  phone: string;
  planName: string;
}> = {}) {
  return {
    id: overrides.id ?? 'stu-1',
    photo: '',
    firstName: overrides.firstName ?? 'Ana',
    lastName: overrides.lastName ?? 'García',
    documentId: overrides.documentId ?? '10000001',
    isMinor: false,
    guardianName: '',
    guardianDocument: '',
    phone: overrides.phone ?? '3001234567',
    email: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    dateOfBirth: '',
    bloodType: '',
    firstRegistrationDate: TODAY,
    recentRegistrationDate: TODAY,
    registrationDate: TODAY,
    subscriptionEndDate: TODAY,
    monthlyFee: 110000,
    planCategory: 'mensualidad' as const,
    planName: overrides.planName ?? 'Mensualidad',
    planId: 'plan-1',
    payments: [],
    courtesyBonuses: [],
    medicalNotes: '',
    status: 'active' as const,
    beltRank: '',
    consent: { signed: false, signedDate: '', signedVersion: 0, signature: '' },
  };
}

/** Colección de prueba que cubre los 4 escenarios de QA. */
const STUDENTS = [
  base({ id: 's1', firstName: 'Gustavo', lastName: 'Luna',   documentId: '10203040', phone: '3101112222', planName: 'Plan Premium' }),
  base({ id: 's2', firstName: 'María',   lastName: 'López',  documentId: '99887766', phone: '3209998877', planName: 'Chupaculos2' }),
  base({ id: 's3', firstName: 'Carlos',  lastName: 'Rivera', documentId: '11223344', phone: '3150001234', planName: 'Plan Básico' }),
  base({ id: 's4', firstName: 'Lucía',   lastName: 'Luna',   documentId: '55667788', phone: '3119876543', planName: 'Plan Premium' }),
];

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let service: StudentService;

beforeEach(async () => {
  localStorage.clear();
  resetStorageService();
  const storage = await createStorageService();
  // Inyectar los estudiantes de prueba directamente en StorageService.
  await storage.set('students', STUDENTS);
  service = new StudentService();
});

afterEach(() => {
  localStorage.clear();
  resetStorageService();
});

// =============================================================================
// 1. Nombre completo — bug original reportado por QA
// =============================================================================

describe('search — nombre completo', () => {
  it('encuentra a un estudiante buscando "Gustavo Luna" (firstName + lastName)', async () => {
    const results = await service.search('Gustavo Luna');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });

  it('buscar solo el nombre ("Gustavo") también funciona', async () => {
    const results = await service.search('Gustavo');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });

  it('buscar solo el apellido compartido ("Luna") devuelve todos los que lo tienen', async () => {
    const results = await service.search('Luna');
    const ids = results.map((s) => s.id).sort();
    expect(ids).toEqual(['s1', 's4']);
  });

  it('insensible a mayúsculas/minúsculas: "gustavo luna" === "Gustavo Luna"', async () => {
    const results = await service.search('gustavo luna');
    expect(results).toHaveLength(1);
    expect(results[0].firstName).toBe('Gustavo');
  });

  it('ignora espacios extra al inicio/final del query', async () => {
    const results = await service.search('  Gustavo Luna  ');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });
});

// =============================================================================
// 2. Plan — campo que faltaba en el haystack
// =============================================================================

describe('search — nombre del plan', () => {
  it('encuentra estudiantes buscando un plan específico ("Chupaculos2")', async () => {
    const results = await service.search('Chupaculos2');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s2');
  });

  it('coincidencia parcial del plan ("Premium") devuelve todos los del plan', async () => {
    const results = await service.search('Premium');
    const ids = results.map((s) => s.id).sort();
    expect(ids).toEqual(['s1', 's4']);
  });

  it('búsqueda de plan insensible a mayúsculas ("plan básico")', async () => {
    const results = await service.search('plan básico');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s3');
  });
});

// =============================================================================
// 3. Documento (cédula) — coincidencias parciales y totales
// =============================================================================

describe('search — documento (cédula)', () => {
  it('búsqueda exacta del documento devuelve el estudiante correcto', async () => {
    const results = await service.search('10203040');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });

  it('coincidencia parcial del documento ("1020") devuelve el estudiante correcto', async () => {
    const results = await service.search('1020');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });

  it('coincidencia parcial compartida ("112") devuelve los estudiantes que la tienen', async () => {
    // '11223344' contiene '112' → s3
    const results = await service.search('112');
    const ids = results.map((s) => s.id);
    expect(ids).toContain('s3');
  });
});

// =============================================================================
// 4. Teléfono — coincidencias parciales y totales
// =============================================================================

describe('search — teléfono', () => {
  it('búsqueda exacta del teléfono devuelve el estudiante correcto', async () => {
    const results = await service.search('3101112222');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });

  it('coincidencia parcial del teléfono ("31011") devuelve el estudiante correcto', async () => {
    const results = await service.search('31011');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });

  it('coincidencia parcial compartida ("315") devuelve los estudiantes correctos', async () => {
    // '3150001234' contiene '315' → s3
    const results = await service.search('315');
    const ids = results.map((s) => s.id);
    expect(ids).toContain('s3');
  });
});

// =============================================================================
// 5. Comportamiento de borde
// =============================================================================

describe('search — casos de borde', () => {
  it('query vacío devuelve todos los estudiantes', async () => {
    const results = await service.search('');
    expect(results).toHaveLength(STUDENTS.length);
  });

  it('query sin coincidencia devuelve array vacío', async () => {
    const results = await service.search('XYZ_INEXISTENTE_9999');
    expect(results).toHaveLength(0);
  });

  it('búsqueda sobre colección inyectada (sin leer storage) funciona igual', async () => {
    const results = await service.search('Gustavo Luna', STUDENTS as never);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });
});

// =============================================================================
// 6. Insensibilidad a tildes/diacríticos — QA segunda ronda
// =============================================================================

describe('search — insensibilidad a tildes (diacríticos)', () => {
  // Estudiante con planName y apellido acentuados que no estaban en los
  // fixtures originales. Lo pasamos como colección inyectada para no depender
  // del storage ya sembrado.
  const ACCENTED_STUDENTS = [
    ...STUDENTS,
    base({
      id: 'acento-1',
      firstName: 'María',
      lastName: 'García',
      documentId: '77665544',
      phone: '3170009988',
      planName: 'Estándar',
    }),
    base({
      id: 'acento-2',
      firstName: 'José',
      lastName: 'Núñez',
      documentId: '66554433',
      phone: '3180001122',
      planName: 'Básico Plus',
    }),
  ];

  it('encuentra al estudiante con plan "Estándar" buscando "estandar" (sin tilde)', async () => {
    const results = await service.search('estandar', ACCENTED_STUDENTS as never);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('acento-1');
  });

  it('encuentra al estudiante con apellido "García" buscando "garcia" (sin tilde)', async () => {
    // María García tiene id='acento-1'; el fixture base de s2 también tiene
    // lastName 'López' y firstName 'María', pero apellido distinto.
    const results = await service.search('garcia', ACCENTED_STUDENTS as never);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('acento-1');
  });

  it('buscar "Maria Garcia" (sin tildes) encuentra a María García', async () => {
    const results = await service.search('Maria Garcia', ACCENTED_STUDENTS as never);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('acento-1');
  });

  it('buscar "José" (con tilde) también funciona — normalización es bidireccional', async () => {
    const results = await service.search('José', ACCENTED_STUDENTS as never);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('acento-2');
  });

  it('buscar "jose" (sin tilde) también encuentra a José', async () => {
    const results = await service.search('jose', ACCENTED_STUDENTS as never);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('acento-2');
  });

  it('buscar "nuñez" (con ñ) y "nunez" (sin ñ) devuelven el mismo resultado', async () => {
    const withTilde  = await service.search('nuñez', ACCENTED_STUDENTS as never);
    const withoutTilde = await service.search('nunez', ACCENTED_STUDENTS as never);
    expect(withTilde.map((s) => s.id)).toEqual(withoutTilde.map((s) => s.id));
    expect(withoutTilde[0].id).toBe('acento-2');
  });

  it('buscar "basico" encuentra planes con "Básico" (coincidencia parcial)', async () => {
    // "Plan Básico" (s3) y "Básico Plus" (acento-2) ambos contienen "básico".
    const results = await service.search('basico', ACCENTED_STUDENTS as never);
    const ids = results.map((s) => s.id).sort();
    expect(ids).toContain('acento-2');
    expect(ids).toContain('s3');
  });
});
