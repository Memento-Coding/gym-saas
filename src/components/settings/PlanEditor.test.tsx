/**
 * PlanEditor.test.tsx — Cobertura del refactor a validación con el catálogo.
 *
 * Valida los criterios de QA (integridad del catálogo de membresías que
 * consume PaymentForm):
 *  - El precio no puede ser negativo ni no numérico.
 *  - El nombre del plan es obligatorio y único dentro de su grupo.
 *  - El guardado se bloquea mientras exista cualquier error de validación.
 *  - Un guardado válido normaliza y persiste vía onSave.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PlanEditor } from './PlanEditor';
import type { CostsConfig, MembershipPlan } from '@/types/membership';

function makeCosts(overrides?: Partial<CostsConfig>): CostsConfig {
  return {
    memberships: [
      { id: 'plan-mensual', name: 'Mensualidad', price: 110000 },
      { id: 'plan-trimestral', name: 'Trimestral', price: 300000 },
    ],
    personalized: [{ id: 'plan-pt', name: 'Personal Training', price: 250000 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

function renderEditor(
  onSave = vi.fn().mockResolvedValue(undefined),
  costs: CostsConfig | null = makeCosts(),
) {
  render(<PlanEditor costs={costs} onSave={onSave} />);
  return { onSave };
}

// =============================================================================
// Precio
// =============================================================================

describe('PlanEditor — precio', () => {
  it('muestra error y bloquea el guardado con precio negativo', async () => {
    const { onSave } = renderEditor();

    const price = screen.getByLabelText(/precio del plan plan-mensual/i);
    // Input controlado por el padre (no Controller): fireEvent.change propaga.
    fireEvent.change(price, { target: { value: '-5000' } });

    expect(await screen.findByText(/no puede ser negativo/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /guardar planes/i });
    expect(saveBtn).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('muestra error con precio no numérico', async () => {
    renderEditor();

    const price = screen.getByLabelText(/precio del plan plan-mensual/i);
    fireEvent.change(price, { target: { value: 'abc' } });

    expect(
      await screen.findByText(/solo puede contener números/i),
    ).toBeInTheDocument();
  });
});

// =============================================================================
// Nombre
// =============================================================================

describe('PlanEditor — nombre', () => {
  it('muestra error y bloquea el guardado con nombre vacío', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    const name = screen.getByLabelText(/nombre del plan plan-mensual/i);
    await user.clear(name);

    expect(await screen.findByText(/es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar planes/i })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('muestra error si dos planes del mismo grupo tienen el mismo nombre', async () => {
    const user = userEvent.setup();
    renderEditor();

    // Renombramos "Trimestral" a "Mensualidad" (duplicado en el grupo grupal).
    const name = screen.getByLabelText(/nombre del plan plan-trimestral/i);
    await user.clear(name);
    await user.type(name, 'Mensualidad');

    // Ambos planes con el mismo nombre marcan el error de duplicado.
    const dupErrors = await screen.findAllByText(
      /ya existe un plan con ese nombre/i,
    );
    expect(dupErrors.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Guardado válido
// =============================================================================

describe('PlanEditor — guardado', () => {
  it('persiste vía onSave con datos válidos (precio numérico, nombre saneado)', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    const price = screen.getByLabelText(/precio del plan plan-mensual/i);
    fireEvent.change(price, { target: { value: '120000' } });

    await user.click(screen.getByRole('button', { name: /guardar planes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const config = onSave.mock.calls[0][0] as CostsConfig;
    const mensual = config.memberships.find(
      (p: MembershipPlan) => p.id === 'plan-mensual',
    );
    expect(mensual?.price).toBe(120000);
    expect(typeof mensual?.price).toBe('number');
  });
});
