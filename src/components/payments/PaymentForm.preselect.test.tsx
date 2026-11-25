import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { MembershipPlan } from '@/types/membership';

const groupPlans: MembershipPlan[] = [
  { id: 'p1', name: 'Básico', price: 80000 },
  { id: 'p2', name: 'Estándar', price: 95000 },
];
const personalizedPlans: MembershipPlan[] = [{ id: 'p3', name: 'Personal', price: 200000 }];

vi.mock('@/hooks/useMemberships', () => ({
  useMemberships: () => ({
    groupPlans,
    personalizedPlans,
    getPlanById: (id: string) => {
      const g = groupPlans.find((p) => p.id === id);
      if (g) return { plan: g, category: 'mensualidad' };
      const p = personalizedPlans.find((x) => x.id === id);
      return p ? { plan: p, category: 'personalizada' } : undefined;
    },
  }),
}));

import { PaymentForm } from './PaymentForm';

const trigger = () => screen.getAllByRole('combobox')[0]; // el de plan es el primero

describe('PaymentForm — plan preseleccionado', () => {
  it('preselecciona el plan actual del alumno', async () => {
    render(<PaymentForm studentId="s1" currentPlanName="Estándar" onSubmit={vi.fn()} />);
    await waitFor(() => expect(trigger()).toHaveTextContent('Estándar'));
  });

  it('@adversarial un plan que ya no existe deja el select vacío', () => {
    render(<PaymentForm studentId="s1" currentPlanName="Plan borrado" onSubmit={vi.fn()} />);
    expect(trigger()).toHaveTextContent('Selecciona un plan');
  });

  it('sin plan actual no preselecciona nada', () => {
    render(<PaymentForm studentId="s1" onSubmit={vi.fn()} />);
    expect(trigger()).toHaveTextContent('Selecciona un plan');
  });
});
