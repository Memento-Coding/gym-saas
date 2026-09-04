/**
 * StudentService.freeze.test.ts — Cobertura de las reglas de negocio del
 * congelamiento (Req 11.1 y 11.2).
 *
 * Valida los tres escenarios del reporte de QA:
 *  1. Rechaza congelar a un estudiante con pago vencido.
 *  2. Rechaza congelar a un estudiante inactivo.
 *  3. Al congelar una cuenta válida (al día / por vencer), el status
 *     resultante es exactamente 'frozen', nunca 'active'.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StudentService } from './StudentService';
import { createStorageService, resetStorageService } from './storage/StorageService';
import type { Student } from '@/types/student';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Genera una fecha ISO relativa a hoy. días > 0 → futuro, < 0 → pasado. */
function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeStudent(
  overrides: Partial<Student> & { id: string },
): Student {
  return {
    photo: '',
    firstName: 'Test',
    lastName: 'User',
    documentId: '10000001',
    isMinor: false,
    guardianName: '',
    guardianDocument: '',
    phone: '',
    email: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    dateOfBirth: '',
    bloodType: '',
    firstRegistrationDate: '2024-01-01',
    recentRegistrationDate: '2024-01-01',
    registrationDate: '2024-01-01',
    subscriptionEndDate: daysFromToday(10),
    monthlyFee: 110000,
    planCategory: 'mensualidad',
    planName: 'Mensualidad',
    planId: 'plan-1',
    payments: [],
    courtesyBonuses: [],
    medicalNotes: '',
    beltRank: '',
    consent: { signed: false, signedDate: '', signedVersion: 0, signature: '' },
    status: 'active',
    ...overrides,
  };
}

let service: StudentService;

beforeEach(async () => {
  localStorage.clear();
  resetStorageService();
  const storage = await createStorageService();
  service = new StudentService();
  // Silenciar referencia a storage — StudentService usa el singleton interno.
  void storage;
});

afterEach(() => {
  localStorage.clear();
  resetStorageService();
});

/** Siembra un estudiante en el storage y devuelve su id. */
async function seed(student: Student): Promise<string> {
  const storage = await (await import('./storage/StorageService')).getStorageService();
  const current = (await storage.get<Student[]>('students')) ?? [];
  await storage.set('students', [...current, student]);
  return student.id;
}

// =============================================================================
// Fix #1 — Restricción de negocio: rechazar congelamiento de cuentas no válidas
// =============================================================================

describe('freezeStudent — restricciones de negocio', () => {
  it('rechaza congelar un estudiante con pago VENCIDO (subscriptionEndDate pasada)', async () => {
    const id = await seed(
      makeStudent({ id: 'vencido-1', subscriptionEndDate: daysFromToday(-5), status: 'active' }),
    );

    const result = await service.freezeStudent(id, 'Viaje', 30);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/vencido/i);
    }
  });

  it('rechaza congelar un estudiante con status INACTIVO', async () => {
    const id = await seed(
      makeStudent({ id: 'inactive-1', subscriptionEndDate: daysFromToday(-20), status: 'inactive' }),
    );

    const result = await service.freezeStudent(id, 'Lesión', 14);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/inactiv/i);
    }
  });

  it('rechaza congelar un estudiante ya CONGELADO', async () => {
    // Un estudiante frozen tiene status='frozen', no 'active' → canFreeze=false.
    const id = await seed(
      makeStudent({
        id: 'frozen-1',
        subscriptionEndDate: daysFromToday(20),
        status: 'frozen',
        freezeEndDate: daysFromToday(10),
      }),
    );

    const result = await service.freezeStudent(id, 'Viaje', 7);

    // No es 'active' → rechazado por la restricción de status o por ya estar frozen.
    expect(result.success).toBe(false);
  });

  it('permite congelar un estudiante AL DÍA (subscriptionEndDate > hoy + 3)', async () => {
    const id = await seed(
      makeStudent({ id: 'aldia-1', subscriptionEndDate: daysFromToday(15), status: 'active' }),
    );

    const result = await service.freezeStudent(id, 'Vacaciones', 30);

    expect(result.success).toBe(true);
  });

  it('permite congelar un estudiante POR VENCER (subscriptionEndDate ≤ hoy + 3)', async () => {
    const id = await seed(
      makeStudent({ id: 'porvencer-1', subscriptionEndDate: daysFromToday(2), status: 'active' }),
    );

    const result = await service.freezeStudent(id, 'Lesión', 7);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Fix #2 — Status correcto: congelar siempre produce status === 'frozen'
// =============================================================================

describe('freezeStudent — transición de status', () => {
  it('el status resultante es "frozen" al congelar una cuenta al día', async () => {
    const id = await seed(
      makeStudent({ id: 'aldia-2', subscriptionEndDate: daysFromToday(15), status: 'active' }),
    );

    const result = await service.freezeStudent(id, 'Motivo', 30);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('frozen');
    }
  });

  it('el status resultante es "frozen" al congelar una cuenta por vencer', async () => {
    const id = await seed(
      makeStudent({ id: 'porvencer-2', subscriptionEndDate: daysFromToday(1), status: 'active' }),
    );

    const result = await service.freezeStudent(id, 'Motivo', 14);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('frozen');
      // Los campos de congelamiento están correctamente poblados.
      expect(result.data.freezeReason).toBe('Motivo');
      expect(result.data.freezeEndDate).toBeTruthy();
      // La fecha de vencimiento se extendió.
      const originalEnd = new Date(daysFromToday(1)).getTime();
      const extendedEnd = new Date(result.data.subscriptionEndDate).getTime();
      expect(extendedEnd).toBeGreaterThan(originalEnd);
    }
  });

  it('freezeEndDate queda en el futuro tras el congelamiento', async () => {
    const id = await seed(
      makeStudent({ id: 'aldia-3', subscriptionEndDate: daysFromToday(20), status: 'active' }),
    );

    const result = await service.freezeStudent(id, 'Test', 30);

    expect(result.success).toBe(true);
    if (result.success) {
      const freezeEnd = new Date(result.data.freezeEndDate!);
      expect(freezeEnd.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('el estudiante sigue "frozen" al releerlo del storage', async () => {
    const id = await seed(
      makeStudent({ id: 'aldia-4', subscriptionEndDate: daysFromToday(20), status: 'active' }),
    );

    await service.freezeStudent(id, 'Test', 30);
    const reloaded = await service.getById(id);

    expect(reloaded?.status).toBe('frozen');
  });
});
