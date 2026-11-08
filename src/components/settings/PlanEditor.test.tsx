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
import type { Student } from '@/types/student';

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
  students: Pick<Student, 'planId' | 'planName' | 'status'>[] | undefined = [],
) {
  render(<PlanEditor costs={costs} onSave={onSave} students={students} />);
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

// =============================================================================
// Crear y eliminar planes
// =============================================================================

describe('PlanEditor — crear planes', () => {
  async function fillNewPlan(user: ReturnType<typeof userEvent.setup>, name: string, price: string) {
    await user.click(screen.getByRole('button', { name: /agregar plan grupal/i }));
    await user.type(screen.getByLabelText(/nombre del nuevo plan/i), name);
    if (price) await user.type(screen.getByLabelText(/precio del nuevo plan/i), price);
    await user.click(screen.getByRole('button', { name: /^agregar$/i }));
  }

  it('agrega un plan y lo persiste al guardar', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await fillNewPlan(user, 'Boxeo', '90000');
    await user.click(screen.getByRole('button', { name: /guardar planes/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].memberships.at(-1)).toMatchObject({ name: 'Boxeo', price: 90000 });
  });

  it('rechaza precio vacío y nombre usado en el otro grupo', async () => {
    const user = userEvent.setup();
    renderEditor();

    await fillNewPlan(user, 'Boxeo', '');
    expect(await screen.findByText(/el precio es obligatorio/i)).toBeInTheDocument();

    const name = screen.getByLabelText(/nombre del nuevo plan/i);
    await user.clear(name);
    await user.type(name, 'personal training');
    await user.type(screen.getByLabelText(/precio del nuevo plan/i), '1000');
    await user.click(screen.getByRole('button', { name: /^agregar$/i }));
    expect(await screen.findByText(/ya existe un plan con ese nombre/i)).toBeInTheDocument();
  });
});

describe('PlanEditor — eliminar planes', () => {
  const eliminar = (name: string) =>
    screen.getByRole('button', { name: new RegExp(`eliminar plan ${name}`, 'i') });

  it('elimina un plan sin estudiantes y lo persiste al guardar', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await user.click(eliminar('Trimestral'));
    await user.click(screen.getByRole('button', { name: /guardar planes/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].memberships.map((p: MembershipPlan) => p.id)).toEqual(['plan-mensual']);
  });

  it('bloquea eliminar por planId o por el nombre en registros antiguos', () => {
    renderEditor(undefined, undefined, [
      { planId: 'plan-mensual', planName: 'Otro', status: 'active' },
      { planId: '', planName: 'Trimestral', status: 'frozen' },
    ]);
    expect(eliminar('Mensualidad')).toBeDisabled();
    expect(eliminar('Trimestral')).toBeDisabled();
    expect(screen.getAllByText(/en uso por 1 estudiante/i)).toHaveLength(2);
  });

  it('un estudiante inactivo no bloquea', () => {
    renderEditor(undefined, undefined, [{ planId: 'plan-mensual', planName: 'Mensualidad', status: 'inactive' }]);
    expect(eliminar('Mensualidad')).toBeEnabled();
  });

  it('renombrar sin guardar no esconde a sus estudiantes', () => {
    renderEditor(undefined, undefined, [{ planId: '', planName: 'Trimestral', status: 'active' }]);
    fireEvent.change(screen.getByLabelText(/nombre del plan plan-trimestral/i), { target: { value: 'Nuevo' } });
    expect(eliminar('Nuevo')).toBeDisabled();
  });

  it('sin datos de estudiantes no permite eliminar', () => {
    render(<PlanEditor costs={makeCosts()} onSave={vi.fn()} />);
    expect(eliminar('Trimestral')).toBeDisabled();
  });

  it('no permite eliminar el último plan', () => {
    renderEditor(undefined, {
      memberships: [{ id: 'unico', name: 'Unico', price: 1000 }],
      personalized: [],
    });
    expect(eliminar('Unico')).toBeDisabled();
  });
});

describe('PlanEditor — claridad y cambios sin guardar', () => {
  it('explica en una frase qué significa cada forma de cobro', () => {
    renderEditor(undefined, {
      memberships: [
        { id: 'a', name: 'Mensual', price: 110000, classesPerMonth: 12 },
        { id: 'b', name: 'Suelta', price: 20000, single: true },
      ],
      personalized: [],
    });
    expect(screen.getByText(/\$110\.000 al mes\. Cada pago suma un mes al vencimiento\. Incluye 12 clases\./)).toBeInTheDocument();
    expect(screen.getByText(/\$20\.000 por clase\. El pago no cambia la fecha de vencimiento\./)).toBeInTheDocument();
  });

  it('sin cambios no ofrece guardar; descartar vuelve a lo guardado', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    expect(screen.queryByRole('button', { name: /guardar planes/i })).toBeNull();

    const price = screen.getByLabelText(/precio del plan plan-mensual/i);
    fireEvent.change(price, { target: { value: '5' } });
    await user.click(screen.getByRole('button', { name: /descartar cambios/i }));

    expect(price).toHaveValue('110000');
    expect(screen.queryByRole('button', { name: /guardar planes/i })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('tras guardar deja de haber cambios pendientes', async () => {
    const user = userEvent.setup();
    renderEditor();
    fireEvent.change(screen.getByLabelText(/precio del plan plan-mensual/i), { target: { value: '5' } });
    await user.click(screen.getByRole('button', { name: /guardar planes/i }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /guardar planes/i })).toBeNull(),
    );
  });

  it('valida las clases al mes de un plan existente', async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText(/clases al mes del plan plan-mensual/i), { target: { value: '101' } });
    expect(await screen.findByText(/las clases al mes debe estar entre 1 y 100/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar planes/i })).toBeDisabled();
  });
});
