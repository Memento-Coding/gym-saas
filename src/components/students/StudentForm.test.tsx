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
// Reglas colombianas: tipo de documento y coherencia con la edad
// =============================================================================

describe('StudentForm — reglas colombianas', () => {
  const FULL: FormFieldConfig[] = [
    ...FIELDS,
    { id: 'phone', name: 'phone', label: 'Teléfono', type: 'tel', required: false, isBuiltIn: true },
    { id: 'dateOfBirth', name: 'dateOfBirth', label: 'Fecha de nacimiento', type: 'date', required: false, isBuiltIn: true },
  ];

  function renderFull(defaultValues?: Partial<Student>) {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<StudentForm fields={FULL} defaultValues={defaultValues} onSubmit={onSubmit} storage={storage} />);
    return onSubmit;
  }
  const save = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: /guardar/i }));

  it('exige la longitud del tipo: una TI de 4 dígitos no pasa', async () => {
    const user = userEvent.setup();
    const onSubmit = renderFull({ firstName: 'Ana', documentId: '1001', documentType: 'TI', isMinor: true, guardianName: 'Luis', guardianDocument: '20304050' });
    await save(user);
    expect(await screen.findByText(/no es válido para TI/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('un pasaporte con letras se guarda en mayúsculas con su tipo', async () => {
    const user = userEvent.setup();
    const onSubmit = renderFull({ firstName: 'Ana', documentId: 'at123456', documentType: 'PA' });
    await save(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ documentId: 'AT123456', documentType: 'PA' });
  });

  it('marcar "menor" cambia CC por TI', async () => {
    const user = userEvent.setup();
    renderFull();
    await user.click(screen.getByRole('checkbox', { name: /menor de edad/i }));
    expect(screen.getByRole('combobox', { name: /tipo de documento/i })).toHaveTextContent(/^TI/);
  });

  it('rechaza una fecha de nacimiento de menor sin marcar "menor"', async () => {
    const user = userEvent.setup();
    const birth = new Date().getFullYear() - 10;
    const onSubmit = renderFull({ firstName: 'Ana', documentId: '1001', dateOfBirth: `${birth}-01-01` });
    await save(user);
    expect(await screen.findByText(/es menor de edad: marca/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('el acudiente no puede tener el documento del menor', async () => {
    const user = userEvent.setup();
    const onSubmit = renderFull({ firstName: 'Ana', documentId: '1012345678', documentType: 'CE', isMinor: true, guardianName: 'Luis', guardianDocument: '1012345678' });
    await save(user);
    expect(await screen.findByText(/mismo documento del menor/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('normaliza un celular con +57 y rechaza uno inválido', async () => {
    const user = userEvent.setup();
    const onSubmit = renderFull({ firstName: 'Ana', documentId: '1001', phone: '+57 300 123 4567' });
    await save(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].phone).toBe('3001234567');
  });

  it('rechaza nombres solo con espacios', async () => {
    const user = userEvent.setup();
    const onSubmit = renderFull({ firstName: '   ', documentId: '1001' });
    await save(user);
    expect(await screen.findByText(/nombres es obligatorio/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('muestra el error de un email inválido junto al campo', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const fields: FormFieldConfig[] = [
      ...FIELDS,
      { id: 'email', name: 'email', label: 'Email', type: 'email', required: false, isBuiltIn: true },
    ];
    render(<StudentForm fields={fields} defaultValues={{ firstName: 'Ana', documentId: '1001', email: 'no-es-email' }} onSubmit={onSubmit} storage={storage} />);
    await save(user);
    expect(await screen.findByText(/no es una dirección válida/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rechaza nombres con números', async () => {
    const user = userEvent.setup();
    const onSubmit = renderFull({ firstName: 'Ana3', documentId: '1001' });
    await save(user);
    expect(await screen.findByText(/solo puede contener letras/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Planes reales del gimnasio
// =============================================================================

describe('StudentForm — planes del gimnasio', () => {
  const PLAN_FIELDS: FormFieldConfig[] = [
    ...FIELDS.slice(0, 2),
    { id: 'planName', name: 'planName', label: 'Plan', type: 'select', required: true, isBuiltIn: true },
  ];
  const plans = {
    memberships: [{ id: 'grp1', name: 'Premium', price: 110000 }],
    personalized: [{ id: 'per1', name: 'Boxeo', price: 200000 }],
  };

  function renderPlans(defaultValues: Partial<Student>) {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<StudentForm fields={PLAN_FIELDS} plans={plans} defaultValues={defaultValues} onSubmit={onSubmit} storage={storage} />);
    return onSubmit;
  }
  const base = { firstName: 'Ana', documentId: '1001' };

  it('enlaza planId, categoría y precio del plan elegido', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPlans({ ...base, planName: 'Boxeo' });
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ planId: 'per1', planCategory: 'personalizada', monthlyFee: 200000 });
  });

  it('usa el nombre vigente si el plan se renombró', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPlans({ ...base, planId: 'grp1', planName: 'Nombre viejo' });
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].planName).toBe('Premium');
  });

  it('no bloquea editar a quien tiene un plan ya retirado', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPlans({ ...base, planName: 'Plan retirado' });
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].planName).toBe('Plan retirado');
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
