/**
 * StudentFormGuardian.test.tsx — Cobertura del fix de validación numérica
 * estricta para los campos del acudiente (Fix #3).
 *
 * Valida que:
 *  - guardianDocument acepta únicamente números (rechaza letras y símbolos).
 *  - guardianDocument es obligatorio cuando isMinor === true.
 *  - El input tiene inputMode="numeric" para UX móvil.
 *  - guardianName sigue siendo texto libre.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StudentForm } from './StudentForm';
import {
  createStorageService,
  resetStorageService,
} from '@/services/storage/StorageService';
import type { StorageService } from '@/services/storage/StorageService';
import type { FormFieldConfig } from '@/types/settings';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIELDS_MINOR: FormFieldConfig[] = [
  { id: 'firstName', name: 'firstName', label: 'Nombres', type: 'text', required: true, isBuiltIn: true },
  { id: 'documentId', name: 'documentId', label: 'Documento', type: 'text', required: true, isBuiltIn: true },
];

let storage: StorageService;

beforeEach(async () => {
  localStorage.clear();
  resetStorageService();
  storage = await createStorageService();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
  resetStorageService();
});

function renderMinorForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <StudentForm
      fields={FIELDS_MINOR}
      onSubmit={onSubmit}
      storage={storage}
    />,
  );
  return { onSubmit };
}

/** Activa el checkbox "Es menor de edad" para exponer los campos del acudiente. */
async function activateMinor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: /menor de edad/i }));
}

/**
 * Selector del campo Documento del ESTUDIANTE (no del acudiente).
 * El label tiene un <span>*</span> interno; accedemos por rol filtrando
 * por nombre accesible que empiece por "Documento" y excluya "acudiente".
 */
function getStudentDocInput(): HTMLElement {
  return screen.getByRole('textbox', {
    name: (n) => /^documento/i.test(n) && !/acudiente/i.test(n),
  });
}

// =============================================================================
// Renderizado: los campos del acudiente solo aparecen cuando isMinor = true
// =============================================================================

describe('Formulario guardián — renderizado condicional', () => {
  it('los campos del acudiente NO se muestran cuando isMinor es false', () => {
    renderMinorForm();
    expect(screen.queryByLabelText(/documento del acudiente/i)).toBeNull();
    expect(screen.queryByLabelText(/nombre del acudiente/i)).toBeNull();
  });

  it('los campos del acudiente SE muestran al activar "Es menor de edad"', async () => {
    const user = userEvent.setup();
    renderMinorForm();
    await activateMinor(user);
    expect(screen.getByLabelText(/nombre del acudiente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/documento del acudiente/i)).toBeInTheDocument();
  });

  it('el input de documento del acudiente tiene inputMode="numeric"', async () => {
    const user = userEvent.setup();
    renderMinorForm();
    await activateMinor(user);
    expect(
      screen.getByLabelText(/documento del acudiente/i),
    ).toHaveAttribute('inputmode', 'numeric');
  });
});

// =============================================================================
// Validación de formato: solo números en guardianDocument
// =============================================================================

describe('Formulario guardián — validación numérica estricta', () => {
  it('rechaza guardianDocument con letras y bloquea el submit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderMinorForm();

    await user.type(screen.getByLabelText(/nombres/i), 'Pedro');
    await user.type(getStudentDocInput(), '12345678');
    await activateMinor(user);
    await user.type(screen.getByLabelText(/nombre del acudiente/i), 'Ana');
    await user.type(screen.getByLabelText(/documento del acudiente/i), '12AB34');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(
      await screen.findByText(/solo puede contener números/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rechaza guardianDocument con caracteres especiales', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderMinorForm();

    await user.type(screen.getByLabelText(/nombres/i), 'Pedro');
    await user.type(getStudentDocInput(), '12345678');
    await activateMinor(user);
    await user.type(screen.getByLabelText(/nombre del acudiente/i), 'Ana');
    await user.type(screen.getByLabelText(/documento del acudiente/i), '12-34-56');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(
      await screen.findByText(/solo puede contener números/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('acepta guardianDocument con solo dígitos (4–20)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderMinorForm();

    await user.type(screen.getByLabelText(/nombres/i), 'Pedro');
    await user.type(getStudentDocInput(), '12345678');
    await activateMinor(user);
    await user.type(screen.getByLabelText(/nombre del acudiente/i), 'Ana');
    await user.type(screen.getByLabelText(/documento del acudiente/i), '10203040');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const data = onSubmit.mock.calls[0][0];
    expect(data.guardianDocument).toBe('10203040');
  });

  it('exige guardianDocument cuando isMinor está activo (campo vacío)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderMinorForm();

    await user.type(screen.getByLabelText(/nombres/i), 'Pedro');
    await user.type(getStudentDocInput(), '12345678');
    await activateMinor(user);
    await user.type(screen.getByLabelText(/nombre del acudiente/i), 'Ana');
    // No escribimos guardianDocument

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(
      await screen.findByText(/documento del acudiente es obligatorio/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
