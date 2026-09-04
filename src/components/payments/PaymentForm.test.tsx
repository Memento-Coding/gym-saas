/**
 * PaymentForm.test.tsx — Cobertura del refactor a zodResolver (Paso 2 migración).
 *
 * Valida los criterios de QA del refactor:
 *  - El descuento (input numérico) rechaza negativos y texto.
 *  - El select de Plan consume datos dinámicos reales y falla si el plan no existe.
 *  - No existe input manual de "Fecha de vencimiento"; se calcula automáticamente
 *    con computeSubscriptionEndDate y se muestra read-only.
 *  - Un envío válido produce un PaymentInput correcto (amount = precio del plan).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PaymentForm } from './PaymentForm';
import { computeSubscriptionEndDate, toIsoDateUTC } from '@/utils/validation';
import type { MembershipPlan } from '@/types/membership';
import type { Student } from '@/types/student';
import type { PaymentInput } from '@/services/PaymentService';

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const GROUP_PLANS: MembershipPlan[] = [
  { id: 'plan-mensual', name: 'Mensualidad', price: 110000 },
  { id: 'plan-trimestral', name: 'Trimestral', price: 300000 },
];

const PERSONALIZED_PLANS: MembershipPlan[] = [
  { id: 'plan-pt', name: 'Personal Training', price: 250000 },
];

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'stu-1',
    photo: '',
    firstName: 'Ana',
    lastName: 'García',
    documentId: '12345678',
    isMinor: false,
    guardianName: '',
    guardianDocument: '',
    phone: '',
    email: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    dateOfBirth: '1990-01-01',
    bloodType: '',
    firstRegistrationDate: '2024-01-01',
    recentRegistrationDate: '2024-01-01',
    registrationDate: '2024-01-01',
    subscriptionEndDate: '2024-01-31',
    monthlyFee: 110000,
    planCategory: 'mensualidad',
    planName: 'Mensualidad',
    planId: 'plan-mensual',
    payments: [],
    courtesyBonuses: [],
    medicalNotes: '',
    status: 'active',
    beltRank: '',
    consent: {} as Student['consent'],
    ...overrides,
  };
}

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined), student = makeStudent()) {
  render(
    <PaymentForm
      student={student}
      groupPlans={GROUP_PLANS}
      personalizedPlans={PERSONALIZED_PLANS}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// UI / estructura
// =============================================================================

describe('PaymentForm — estructura', () => {
  it('NO renderiza ningún input manual de fecha de vencimiento', () => {
    renderForm();
    // Solo debe existir un input de tipo date: la fecha de pago.
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(1);
    expect(screen.queryByLabelText(/vencimiento/i)).toBeNull();
  });

  it('muestra la fecha de vencimiento calculada automáticamente (read-only)', () => {
    const student = makeStudent({ subscriptionEndDate: '2024-01-31' });
    renderForm(vi.fn(), student);

    const today = toIsoDateUTC(new Date());
    const expected = computeSubscriptionEndDate(
      '2024-01-31',
      today,
      'paid',
      GROUP_PLANS[0], // plan-mensual (default del estudiante)
    );

    const el = screen.getByTestId('computed-end-date');
    expect(el.textContent).toBe(expected);
    // El valor mostrado no es un campo editable.
    expect(el.tagName.toLowerCase()).not.toBe('input');
  });
});

// =============================================================================
// Validación numérica del descuento (STEERING_FORMS §1)
// =============================================================================

describe('PaymentForm — descuento (input numérico)', () => {
  it('rechaza descuento negativo y no invoca onSubmit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const discount = screen.getByLabelText(/^descuento \(\$\)/i) as HTMLInputElement;
    await user.clear(discount);
    await user.type(discount, '-500');

    await user.click(screen.getByRole('button', { name: /registrar pago/i }));

    expect(
      await screen.findByText(/no puede ser negativo/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rechaza descuento mayor o igual al precio del plan', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const discount = screen.getByLabelText(/^descuento \(\$\)/i) as HTMLInputElement;
    await user.clear(discount);
    await user.type(discount, '200000'); // >= 110000 (plan-mensual)

    await user.click(screen.getByRole('button', { name: /registrar pago/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no puede ser mayor o igual al precio/i),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Envío válido → PaymentInput correcto
// =============================================================================

describe('PaymentForm — envío válido', () => {
  it('emite un PaymentInput con amount = precio del plan seleccionado', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    // El estudiante ya trae plan-mensual como default → formulario válido.
    await user.click(screen.getByRole('button', { name: /registrar pago/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const input = onSubmit.mock.calls[0][0] as PaymentInput;
    expect(input.studentId).toBe('stu-1');
    expect(input.planName).toBe('Mensualidad');
    expect(input.amount).toBe(110000);
    expect(input.discount).toBe(0);
    expect(input.status).toBe('paid');
    expect(input.category).toBe('mensualidad');
  });

  it('bloquea el envío si no hay plan válido seleccionado (catálogo real)', async () => {
    const user = userEvent.setup();
    // Estudiante con planId que NO existe en el catálogo → select inválido.
    const student = makeStudent({ planId: 'plan-eliminado' });
    const { onSubmit } = renderForm(vi.fn().mockResolvedValue(undefined), student);

    await user.click(screen.getByRole('button', { name: /registrar pago/i }));

    await waitFor(() => {
      expect(screen.getByText(/no es una opción válida/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
