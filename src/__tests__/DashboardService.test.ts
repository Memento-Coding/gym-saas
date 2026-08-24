/**
 * Property-based tests para DashboardService (Track D — Dev 4, Task 20.2).
 *
 * Valida las propiedades de correctitud 25, 26 y 27 definidas en el design.md
 * del spec meraki-web-app usando fast-check con un mínimo de 100 iteraciones
 * por propiedad.
 *
 * Validates: Requirements 10.1, 10.2, 10.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  calculateMetrics,
  classifyStudent,
  generateAlerts,
  isBirthdayToday,
  type StudentCategory,
} from '@/services/DashboardService';
import type { Student } from '@/types/student';
import type { ConsentRecord } from '@/types/consent';

// =============================================================================
// Generadores personalizados
// =============================================================================

/** Fecha de referencia fija ("hoy") para pruebas deterministas. */
const NOW = new Date(2026, 7, 22); // 22 de agosto de 2026 (mes 0-indexado: 7)

/** Genera un ConsentRecord con estado de firma controlable. */
function consentArb(signed: boolean): ConsentRecord {
  return {
    signed,
    signedDate: signed ? '2026-01-01T00:00:00.000Z' : '',
    signedVersion: signed ? 1 : 0,
    signature: signed ? 'data:image/png;base64,AAAA' : '',
  };
}

/**
 * Genera una fecha ISO desplazada `offsetDays` respecto de NOW.
 * Devuelve solo la parte de fecha para evitar ruido de zona horaria.
 */
function isoFromOffset(offsetDays: number): string {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Genera un estudiante válido con status, fecha de vencimiento y consentimiento
 * variados, cubriendo todas las categorías posibles del dashboard.
 */
const studentArb: fc.Arbitrary<Student> = fc
  .record({
    id: fc.uuid(),
    firstName: fc.string({ minLength: 1, maxLength: 12 }),
    lastName: fc.string({ minLength: 1, maxLength: 12 }),
    status: fc.constantFrom('active', 'frozen', 'inactive') as fc.Arbitrary<
      Student['status']
    >,
    // Desplazamiento de vencimiento: desde muy vencido (-40) hasta lejano (+40)
    endOffset: fc.integer({ min: -40, max: 40 }),
    consentSigned: fc.boolean(),
    // Desplazamiento de fecha de nacimiento (para variar mes/día)
    birthOffset: fc.integer({ min: -400, max: 400 }),
  })
  .map(({ id, firstName, lastName, status, endOffset, consentSigned, birthOffset }) => {
    const base: Student = {
      id,
      photo: '',
      firstName,
      lastName,
      documentId: id.slice(0, 8),
      isMinor: false,
      guardianName: '',
      guardianDocument: '',
      phone: '',
      email: '',
      emergencyName: '',
      emergencyPhone: '',
      emergencyRelation: '',
      dateOfBirth: isoFromOffset(birthOffset),
      bloodType: '',
      firstRegistrationDate: isoFromOffset(-365),
      recentRegistrationDate: isoFromOffset(-30),
      registrationDate: isoFromOffset(-30),
      subscriptionEndDate: isoFromOffset(endOffset),
      monthlyFee: 0,
      planCategory: 'mensualidad',
      planName: 'Básico',
      planId: 'basico',
      payments: [],
      courtesyBonuses: [],
      medicalNotes: '',
      beltRank: '',
      status,
      consent: consentArb(consentSigned),
    };
    return base;
  });

// =============================================================================
// Tests
// =============================================================================

describe('DashboardService — Property-based tests', () => {
  // Feature: meraki-web-app, Property 25: Dashboard metrics partition
  it('Property 25: la suma de categorías iguala el total y ningún estudiante se cuenta dos veces', () => {
    fc.assert(
      fc.property(fc.array(studentArb), (students) => {
        const metrics = calculateMetrics(students, [], NOW);

        // La suma de las cinco categorías debe igualar el total de estudiantes
        const sum =
          metrics.activeUpToDate +
          metrics.aboutToExpire +
          metrics.expired +
          metrics.frozen +
          metrics.inactive;

        expect(sum).toBe(students.length);
        expect(metrics.total).toBe(students.length);

        // Cada estudiante pertenece a EXACTAMENTE una categoría
        const seen: Record<StudentCategory, number> = {
          active_upToDate: 0,
          aboutToExpire: 0,
          expired: 0,
          frozen: 0,
          inactive: 0,
        };
        for (const s of students) {
          const cat = classifyStudent(s, NOW);
          seen[cat] += 1;
        }
        // El conteo directo por clasificación debe coincidir con las métricas
        expect(seen.active_upToDate).toBe(metrics.activeUpToDate);
        expect(seen.aboutToExpire).toBe(metrics.aboutToExpire);
        expect(seen.expired).toBe(metrics.expired);
        expect(seen.frozen).toBe(metrics.frozen);
        expect(seen.inactive).toBe(metrics.inactive);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: meraki-web-app, Property 26: Dashboard alerts sorted by urgency
  it('Property 26: las alertas están ordenadas por urgencia (vencidas → por vencer → cuotas → sin consentimiento)', () => {
    fc.assert(
      fc.property(
        fc.array(studentArb),
        fc.array(
          fc.record({
            studentId: fc.uuid(),
            dueOffset: fc.integer({ min: -10, max: 20 }),
            amount: fc.integer({ min: 1, max: 1_000_000 }),
          }),
        ),
        (students, rawInstallments) => {
          const installments = rawInstallments.map((i) => ({
            studentId: i.studentId,
            dueDate: isoFromOffset(i.dueOffset),
            amount: i.amount,
          }));

          const alerts = generateAlerts(students, { now: NOW, installments });

          // Las prioridades deben ser monótonamente no decrecientes
          for (let i = 1; i < alerts.length; i++) {
            expect(alerts[i].priority).toBeGreaterThanOrEqual(alerts[i - 1].priority);
          }

          // Y el orden de tipos debe respetar el ranking estricto del spec
          const rank: Record<string, number> = {
            membership_expired: 0,
            membership_expiring: 1,
            installment_expiring: 2,
            no_consent: 3,
          };
          for (let i = 1; i < alerts.length; i++) {
            expect(rank[alerts[i].type]).toBeGreaterThanOrEqual(rank[alerts[i - 1].type]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: meraki-web-app, Property 27: Birthday detection
  it('Property 27: isBirthdayToday retorna true si y solo si coinciden mes y día, sin importar el año', () => {
    fc.assert(
      fc.property(
        // Año de nacimiento arbitrario
        fc.integer({ min: 1950, max: 2020 }),
        // Fecha "hoy" arbitraria dentro de un rango seguro (sin fechas inválidas)
        fc.date({ min: new Date(2000, 0, 1), max: new Date(2030, 11, 31), noInvalidDate: true }),
        // Desplazamiento de días para generar cumpleaños que NO coincide
        fc.integer({ min: 1, max: 300 }),
        (birthYear, today, shiftDays) => {
          const y = today.getFullYear();
          const m = today.getMonth(); // 0-indexado
          const day = today.getDate();

          // Cumpleaños que SÍ coincide (mismo mes+día, distinto año)
          const mm = String(m + 1).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          const matchingDob = `${birthYear}-${mm}-${dd}`;
          expect(isBirthdayToday(matchingDob, today)).toBe(true);

          // Cumpleaños que NO coincide: desplazamos el día del año
          const shifted = new Date(y, m, day + shiftDays);
          const shiftedMonthDay =
            `${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(
              shifted.getDate(),
            ).padStart(2, '0')}`;
          const todayMonthDay = `${mm}-${dd}`;

          const nonMatchingDob = `${birthYear}-${shiftedMonthDay}`;
          const expected = shiftedMonthDay === todayMonthDay;
          expect(isBirthdayToday(nonMatchingDob, today)).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
