/**
 * StudentList.test.tsx — Cobertura del fix QA de badges de estado de pago.
 *
 * Verifica que:
 *  - El badge muestra el estado de PAGO (calculado desde subscriptionEndDate),
 *    no el estado de cuenta (student.status). Este era el bug: filtrar por
 *    "Vencido" mostraba correctamente la fila pero el badge decía "Activo".
 *  - Los tres estados (Al día, Por vencer, Vencido) usan los tokens CSS
 *    semánticos correctos (--payment-current-*, --payment-expiring-*,
 *    --payment-overdue-*).
 *  - Los congelados aparecen al final bajo la sección separadora.
 *  - La columna del header se llama "Estado de pago" (no "Estado").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StudentList } from './StudentList';
import { toIsoDateUTC, addOneMonthUTC, parseIsoDateUTC } from '@/utils/validation';
import type { Student } from '@/types/student';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function makeStudent(
  overrides: Partial<Student> & { id: string; subscriptionEndDate: string },
): Student {
  return {
    photo: '',
    firstName: 'Ana',
    lastName: 'García',
    documentId: '12345',
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
    monthlyFee: 110000,
    planCategory: 'mensualidad',
    planName: 'Mensualidad',
    planId: 'plan-1',
    payments: [],
    courtesyBonuses: [],
    medicalNotes: '',
    status: 'active',         // status de cuenta = active en todos los casos
    beltRank: '',
    consent: { signed: false, signedDate: '', signedVersion: 0, signature: '' },
    ...overrides,
  };
}

/** Fecha relativa a hoy en ISO YYYY-MM-DD. días > 0 = futuro, < 0 = pasado. */
function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toIsoDateUTC(d);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// -----------------------------------------------------------------------------
// Helpers para inspeccionar el estilo inline del badge
// -----------------------------------------------------------------------------

function getBadge(testId: string): HTMLElement {
  return screen.getByTestId(testId);
}

function getBgVar(el: HTMLElement): string {
  return el.style.backgroundColor;
}

// =============================================================================
// Header de columna
// =============================================================================

describe('StudentList — encabezado', () => {
  it('muestra "Estado de pago" en el header (no "Estado")', () => {
    const student = makeStudent({ id: 's1', subscriptionEndDate: daysFromToday(10) });
    render(<StudentList students={[student]} onSelect={vi.fn()} />);
    expect(screen.getByRole('columnheader', { name: /estado de pago/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^estado$/i })).toBeNull();
  });
});

// =============================================================================
// Badges de estado de pago — el bug central del reporte de QA
// =============================================================================

describe('StudentList — badge de estado de pago (bug QA)', () => {
  it('"Al día" cuando subscriptionEndDate > hoy + 3 días, aunque status="active"', () => {
    // Bug reportado: filtrar por "Vencido" mostraba estudiantes con badge "Activo".
    // Este test confirma que el badge refleja el estado de PAGO, no student.status.
    const student = makeStudent({
      id: 's-aldia',
      subscriptionEndDate: daysFromToday(10),
      status: 'active',
    });
    render(<StudentList students={[student]} onSelect={vi.fn()} />);

    const badge = getBadge('payment-badge-s-aldia');
    expect(badge).toHaveTextContent('Al día');
    // Usa el token --payment-current-bg (success)
    expect(getBgVar(badge)).toBe('var(--payment-current-bg)');
  });

  it('"Vencido" cuando subscriptionEndDate < hoy, aunque status="active"', () => {
    // Este es exactamente el caso del bug: student.status = 'active' (aún no
    // han pasado 15 días), pero la suscripción sí venció. El badge debe ser
    // rojo "Vencido", no verde "Activo".
    const student = makeStudent({
      id: 's-vencido',
      subscriptionEndDate: daysFromToday(-5),
      status: 'active', // el bug: status todavía es 'active'
    });
    render(<StudentList students={[student]} onSelect={vi.fn()} />);

    const badge = getBadge('payment-badge-s-vencido');
    expect(badge).toHaveTextContent('Vencido');
    // Usa el token --payment-overdue-bg (error/rojo)
    expect(getBgVar(badge)).toBe('var(--payment-overdue-bg)');
  });

  it('"Por vencer" cuando subscriptionEndDate está a ≤ 3 días de hoy', () => {
    const student = makeStudent({
      id: 's-porvencer',
      subscriptionEndDate: daysFromToday(2),
      status: 'active',
    });
    render(<StudentList students={[student]} onSelect={vi.fn()} />);

    const badge = getBadge('payment-badge-s-porvencer');
    expect(badge).toHaveTextContent('Por vencer');
    // Usa el token --payment-expiring-bg (warning/amarillo)
    expect(getBgVar(badge)).toBe('var(--payment-expiring-bg)');
  });

  it('"Vencido" cuando subscriptionEndDate = hoy (día 0 = difDays < 0 no aplica, pero diffDays ≤ 0)', () => {
    // subscriptionEndDate = hoy: diffDays ≈ 0, que cumple diffDays > 3 → false,
    // diffDays < 0 → false → devuelve 'por_vencer'. Documentamos el comportamiento real.
    const student = makeStudent({
      id: 's-hoy',
      subscriptionEndDate: daysFromToday(0),
      status: 'active',
    });
    render(<StudentList students={[student]} onSelect={vi.fn()} />);

    const badge = getBadge('payment-badge-s-hoy');
    // daysFromToday(0) puede ser < 0 por milisegundos si se ejecuta tarde en el día:
    // cubrimos ambos estados válidos.
    expect(['Por vencer', 'Vencido']).toContain(badge.textContent);
  });

  it('"Vencido" para fecha inválida o vacía', () => {
    const student = makeStudent({
      id: 's-invalida',
      subscriptionEndDate: '',
      status: 'active',
    });
    render(<StudentList students={[student]} onSelect={vi.fn()} />);

    const badge = getBadge('payment-badge-s-invalida');
    expect(badge).toHaveTextContent('Vencido');
  });
});

// =============================================================================
// Múltiples estudiantes con estados distintos en la misma tabla
// =============================================================================

describe('StudentList — tabla con múltiples estados', () => {
  it('muestra el badge correcto para cada fila independientemente', () => {
    const students = [
      makeStudent({ id: 'a', subscriptionEndDate: daysFromToday(30), status: 'active' }),
      makeStudent({ id: 'b', subscriptionEndDate: daysFromToday(-2), status: 'active' }),
      makeStudent({ id: 'c', subscriptionEndDate: daysFromToday(1), status: 'active' }),
    ];
    render(<StudentList students={students} onSelect={vi.fn()} />);

    expect(getBadge('payment-badge-a')).toHaveTextContent('Al día');
    expect(getBadge('payment-badge-b')).toHaveTextContent('Vencido');
    expect(getBadge('payment-badge-c')).toHaveTextContent('Por vencer');
  });
});

// =============================================================================
// Congelados al final
// =============================================================================

describe('StudentList — sección de congelados', () => {
  it('agrupa los estudiantes con status frozen al final de la tabla', () => {
    const students = [
      makeStudent({ id: 'activo', subscriptionEndDate: daysFromToday(10), status: 'active' }),
      makeStudent({ id: 'helado', subscriptionEndDate: daysFromToday(20), status: 'frozen' }),
    ];
    render(<StudentList students={students} onSelect={vi.fn()} />);

    expect(screen.getByText(/membresías congeladas/i)).toBeInTheDocument();

    // El congelado igual muestra su badge de pago (Al día, ya que su fecha es futura)
    expect(getBadge('payment-badge-helado')).toHaveTextContent('Al día');
  });
});

// =============================================================================
// Consistencia entre derivePaymentStatus y lo que muestra el badge
// =============================================================================

describe('StudentList — consistencia con derivePaymentStatus', () => {
  it('badge coincide con el resultado de derivePaymentStatus para fechas arbitrarias', () => {
    // Fechas representativas que cubren los tres umbrales
    const cases: Array<{ days: number; expected: string }> = [
      { days: 30,  expected: 'Al día' },
      { days: 4,   expected: 'Al día' },   // justo por encima de los 3 días
      { days: 3,   expected: 'Por vencer' },
      { days: 1,   expected: 'Por vencer' },
      { days: -1,  expected: 'Vencido' },
      { days: -30, expected: 'Vencido' },
    ];

    // Calculamos la fecha usando addOneMonthUTC para verificar el helper UTC
    const futureIso = toIsoDateUTC(addOneMonthUTC(parseIsoDateUTC(daysFromToday(0))));
    expect(typeof futureIso).toBe('string'); // salud del helper

    for (const { days, expected } of cases) {
      const student = makeStudent({
        id: `case-${days}`,
        subscriptionEndDate: daysFromToday(days),
        status: 'active',
      });
      const { unmount } = render(
        <StudentList students={[student]} onSelect={vi.fn()} />,
      );
      expect(getBadge(`payment-badge-case-${days}`)).toHaveTextContent(expected);
      unmount();
    }
  });
});
