/**
 * StudentForm.test.tsx — Cobertura del refactor a zodResolver + catálogo.
 *
 * Valida los criterios de QA (integridad de datos):
 *  - El campo Documento acepta únicamente números (rechaza texto/símbolos).
 *  - Validación asíncrona dual de unicidad (isDocumentUnique contra
 *    StorageService, simulando backend): bloquea el submit y muestra el error
 *    si el documento ya existe.
 *  - En edición, el propio documento del estudiante no colisiona consigo mismo.
 *  - Campos obligatorios y numéricos siguen el estándar (Mensualidad no negativa).
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
import type { Student } from '@/types/student';

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

const FIELDS: FormFieldConfig[] = [
  { id: 'firstName', name: 'firstName', label: 'Nombres', type: 'text', required: true, isBuiltIn: true },
  { id: 'documentId', name: 'documentId', label: 'Documento', type: 'text', required: true, isBuiltIn: true },
  { id: 'monthlyFee', name: 'monthlyFee', label: 'Mensualidad', type: 'number', required: false, isBuiltIn: true },
];

function seedStudent(id: string, documentId: string): Pick<Student, 'id' | 'documentId'> {
  return { id, documentId };
}

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

function renderForm(
  onSubmit = vi.fn().mockResolvedValue(undefined),
  defaultValues?: Partial<Student>,
) {
  render(
    <StudentForm
      fields={FIELDS}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      storage={storage}
    />,
  );
  return { onSubmit };
}

// =============================================================================
// Documento: solo números
// =============================================================================

describe('StudentForm — documento (solo números)', () => {
  it('rechaza un documento con letras y no invoca onSubmit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/nombres/i), 'Ana');
    await user.type(screen.getByLabelText(/^documento/i), '12AB34');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(
      await screen.findByText(/solo puede contener números/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Unicidad asíncrona (validación dual contra StorageService)
// =============================================================================

describe('StudentForm — unicidad del documento (async)', () => {
  it('bloquea el submit y muestra error si el documento ya existe', async () => {
    await storage.set('students', [seedStudent('otro', '1001')]);

    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/nombres/i), 'Ana');
    await user.type(screen.getByLabelText(/^documento/i), '1001');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(
      await screen.findByText(/ya se encuentra registrado/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('permite el submit si el documento es único', async () => {
    await storage.set('students', [seedStudent('otro', '1001')]);

    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/nombres/i), 'Ana');
    await user.type(screen.getByLabelText(/^documento/i), '2002');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const data = onSubmit.mock.calls[0][0];
    expect(data.documentId).toBe('2002');
    expect(data.firstName).toBe('Ana');
  });

  it('en edición, el propio documento del estudiante no colisiona consigo mismo', async () => {
    await storage.set('students', [
      seedStudent('stu-1', '1001'),
      seedStudent('stu-2', '2002'),
    ]);

    const user = userEvent.setup();
    // Editamos stu-1, que conserva su documento 1001.
    const { onSubmit } = renderForm(vi.fn().mockResolvedValue(undefined), {
      id: 'stu-1',
      firstName: 'Ana',
      documentId: '1001',
    });

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('en edición, NO permite tomar el documento de otro estudiante', async () => {
    await storage.set('students', [
      seedStudent('stu-1', '1001'),
      seedStudent('stu-2', '2002'),
    ]);

    const user = userEvent.setup();
    const { onSubmit } = renderForm(vi.fn().mockResolvedValue(undefined), {
      id: 'stu-1',
      firstName: 'Ana',
      documentId: '1001',
    });

    const doc = screen.getByLabelText(/^documento/i);
    await user.clear(doc);
    await user.type(doc, '2002'); // documento de stu-2

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(
      await screen.findByText(/ya se encuentra registrado/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Campos numéricos y obligatorios
// =============================================================================

describe('StudentForm — campos numéricos y obligatorios', () => {
  it('rechaza una Mensualidad negativa', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/nombres/i), 'Ana');
    await user.type(screen.getByLabelText(/^documento/i), '1001');
    await user.type(screen.getByLabelText(/mensualidad/i), '-5000');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(
      await screen.findByText(/no puede ser negativo/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('bloquea el submit si falta un campo obligatorio (Nombres)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/^documento/i), '1001');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/nombres es obligatorio/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Campo Plan como select requerido (DEFAULT_STUDENT_FIELDS)
// =============================================================================

describe('StudentForm — select de Plan (DEFAULT_STUDENT_FIELDS)', () => {
  // Importamos los campos reales que usan planName como select
  const FIELDS_WITH_PLAN: FormFieldConfig[] = [
    { id: 'firstName', name: 'firstName', label: 'Nombres', type: 'text', required: true, isBuiltIn: true },
    { id: 'documentId', name: 'documentId', label: 'Documento', type: 'text', required: true, isBuiltIn: true },
    {
      id: 'planName',
      name: 'planName',
      label: 'Plan',
      type: 'select',
      required: true,
      isBuiltIn: true,
      options: ['Plan Básico genérico', 'Plan Estándar genérico', 'Plan Premium genérico'],
    },
  ];

  function renderWithPlan(onSubmit = vi.fn().mockResolvedValue(undefined)) {
    render(
      <StudentForm
        fields={FIELDS_WITH_PLAN}
        onSubmit={onSubmit}
        storage={storage}
      />,
    );
    return { onSubmit };
  }

  it('renderiza el campo Plan como un select (trigger visible)', () => {
    renderWithPlan();
    // DynamicField renderiza un <Select> con un trigger que contiene el placeholder
    expect(screen.getByText(/selecciona plan/i)).toBeInTheDocument();
  });

  it('bloquea el submit si Plan no está seleccionado', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderWithPlan();

    await user.type(screen.getByLabelText(/nombres/i), 'Ana');
    await user.type(screen.getByLabelText(/^documento/i), '1001');
    // No seleccionamos plan

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/plan es obligatorio/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('las opciones genéricas están disponibles en el catálogo del select', () => {
    renderWithPlan();
    // El trigger existe; verificamos que las opciones están en el DOM
    // (Radix Select las renderiza como opciones ocultas accesibles)
    expect(screen.getByText(/selecciona plan/i)).toBeInTheDocument();
    // Las opciones están en el DOM (aunque ocultas por Radix)
    expect(document.body.textContent).toContain('Plan Básico genérico');
    expect(document.body.textContent).toContain('Plan Estándar genérico');
    expect(document.body.textContent).toContain('Plan Premium genérico');
  });
});
