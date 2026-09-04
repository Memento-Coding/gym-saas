/**
 * StudentProfile.test.tsx — Cobertura del fix QA del badge de la cabecera.
 *
 * Verifica que el badge junto al nombre del estudiante en el SheetHeader
 * muestra el estado de PAGO (derivePaymentStatus desde subscriptionEndDate),
 * no el estado de cuenta estático (student.status). Este era el bug: abrir
 * el perfil de un estudiante cuya suscripción venció mostraba "Activo" (verde)
 * en la cabecera aunque la tabla ya dijera "Vencido".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StudentProfile } from './StudentProfile';
import type { Student } from '@/types/student';

// -----------------------------------------------------------------------------
// Fixture
// -----------------------------------------------------------------------------

function makeStudent(
  overrides: Partial<Student> & { subscriptionEndDate: string },
): Student {
  return {
    id: 'stu-test',
    photo: '',
    firstName: 'Carlos',
    lastName: 'López',
    documentId: '99887766',
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
    beltRank: '',
    status: 'active',   // fijo en 'active' para aislar el bug
    consent: { signed: false, signedDate: '', signedVersion: 0, signature: '' },
    ...overrides,
  };
}

/** Días desde hoy → ISO YYYY-MM-DD. */
function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const noop = vi.fn().mockResolvedValue(undefined);

function renderProfile(student: Student) {
  render(
    <StudentProfile
      student={student}
      open={true}
      onOpenChange={vi.fn()}
      onEdit={vi.fn()}
      onFreeze={noop}
      onUnfreeze={noop}
      onDelete={noop}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// Bug central: cabecera muestra estado de pago, no estado de cuenta
// =============================================================================

describe('StudentProfile — badge de cabecera (bug QA)', () => {
  it('"Vencido" en cabecera cuando subscriptionEndDate pasó, aunque status="active"', () => {
    // Este era el bug exacto: status = 'active' pero suscripción vencida.
    renderProfile(makeStudent({ subscriptionEndDate: daysFromToday(-5) }));

    const badge = screen.getByTestId('profile-payment-badge');
    expect(badge).toHaveTextContent('Vencido');
    // Token CSS correcto: rojo
    expect(badge.style.backgroundColor).toBe('var(--payment-overdue-bg)');
    expect(badge.style.color).toBe('var(--payment-overdue-text)');
  });

  it('"Al día" en cabecera cuando subscriptionEndDate es futura (> 3 días)', () => {
    renderProfile(makeStudent({ subscriptionEndDate: daysFromToday(15) }));

    const badge = screen.getByTestId('profile-payment-badge');
    expect(badge).toHaveTextContent('Al día');
    expect(badge.style.backgroundColor).toBe('var(--payment-current-bg)');
    expect(badge.style.color).toBe('var(--payment-current-text)');
  });

  it('"Por vencer" en cabecera cuando subscriptionEndDate está a ≤ 3 días', () => {
    renderProfile(makeStudent({ subscriptionEndDate: daysFromToday(2) }));

    const badge = screen.getByTestId('profile-payment-badge');
    expect(badge).toHaveTextContent('Por vencer');
    expect(badge.style.backgroundColor).toBe('var(--payment-expiring-bg)');
    expect(badge.style.color).toBe('var(--payment-expiring-text)');
  });

  it('"Vencido" cuando subscriptionEndDate está vacía o es inválida', () => {
    renderProfile(makeStudent({ subscriptionEndDate: '' }));

    const badge = screen.getByTestId('profile-payment-badge');
    expect(badge).toHaveTextContent('Vencido');
  });
});

// =============================================================================
// El badge de la sección "Estado de pago" en el cuerpo sigue siendo correcto
// =============================================================================

describe('StudentProfile — badge de cuerpo (DetailRow)', () => {
  it('la fila "Estado de pago" en el cuerpo coincide con el badge de cabecera', () => {
    renderProfile(makeStudent({ subscriptionEndDate: daysFromToday(-3) }));

    // Ambos badges deben decir "Vencido"
    const badges = screen.getAllByText('Vencido');
    // Cabecera + fila del cuerpo = al menos 2 elementos con ese texto
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it('para "Al día", cabecera y cuerpo son coherentes', () => {
    renderProfile(makeStudent({ subscriptionEndDate: daysFromToday(20) }));

    const badges = screen.getAllByText('Al día');
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Congelado: la cabecera muestra estado de pago (no "Congelado")
// =============================================================================

describe('StudentProfile — estudiante congelado', () => {
  it('badge de cabecera muestra estado de PAGO incluso cuando status="frozen"', () => {
    // Un estudiante congelado puede tener suscripción vigente o vencida.
    // El badge de cabecera debe reflejar el estado de pago, no "Congelado".
    renderProfile(
      makeStudent({
        subscriptionEndDate: daysFromToday(10),
        status: 'frozen',
        freezeReason: 'Lesión',
        freezeEndDate: daysFromToday(14),
      }),
    );

    const badge = screen.getByTestId('profile-payment-badge');
    // La suscripción es futura → "Al día"
    expect(badge).toHaveTextContent('Al día');
    // El panel de congelado sigue apareciendo
    expect(screen.getByText(/membresía congelada/i)).toBeInTheDocument();
  });
});
