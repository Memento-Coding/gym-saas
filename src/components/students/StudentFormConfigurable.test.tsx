/**
 * StudentForm — formulario configurable (#100): orden, nombres propios,
 * bloque de menor de edad opcional y contacto de emergencia.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StudentForm } from './StudentForm';
import { createStorageService, resetStorageService } from '@/services/storage/StorageService';
import type { StorageService } from '@/services/storage/StorageService';
import type { FormFieldConfig } from '@/types/settings';
import type { Student } from '@/types/student';

const field = (name: string, label: string, over: Partial<FormFieldConfig> = {}): FormFieldConfig => ({
  id: name, name, label, type: 'text', required: false, isBuiltIn: true, ...over,
});
const FIRST = field('firstName', 'Nombres', { required: true });
const DOC = field('documentId', 'Documento', { required: true });
const EMERGENCY = field('emergencyContact', 'Contacto de emergencia');

let storage: StorageService;
beforeEach(async () => {
  localStorage.clear();
  resetStorageService();
  storage = await createStorageService();
});
afterEach(() => {
  localStorage.clear();
  resetStorageService();
});

function setup(
  fields: FormFieldConfig[],
  defaultValues?: Partial<Student>,
  minorBlock = true,
) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <StudentForm
      fields={fields}
      defaultValues={defaultValues}
      minorBlock={minorBlock}
      onSubmit={onSubmit}
      storage={storage}
    />,
  );
  return onSubmit;
}
const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /guardar/i }));

describe('orden y nombres', () => {
  it('renderiza los campos en la secuencia recibida', () => {
    setup([DOC, FIRST, field('beltRank', 'Nivel')]);
    const labels = screen.getAllByText(/^(Nombres|Documento|Nivel)/).map((el) => el.textContent?.replace('*', ''));
    // "Tipo de documento" va junto al Documento; el orden relativo es lo que importa.
    expect(labels.indexOf('Documento')).toBeLessThan(labels.indexOf('Nombres'));
    expect(labels.indexOf('Nombres')).toBeLessThan(labels.indexOf('Nivel'));
  });

  it('muestra el nombre propio de un campo del sistema', () => {
    setup([FIRST, DOC, field('beltRank', 'Nivel')]);
    expect(screen.getByLabelText('Nivel')).toBeInTheDocument();
  });

  it('el dato se guarda bajo la clave interna aunque se haya renombrado', async () => {
    const user = userEvent.setup();
    const onSubmit = setup([FIRST, DOC, field('beltRank', 'Nivel')], { firstName: 'Ana', documentId: '1001' });
    await user.type(screen.getByLabelText('Nivel'), 'Azul');
    await save(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ beltRank: 'Azul' });
  });
});

describe('bloque de menor de edad', () => {
  it('visible por defecto', () => {
    setup([FIRST, DOC]);
    expect(screen.getByLabelText(/es menor de edad/i)).toBeInTheDocument();
  });

  it('oculto: no se renderiza y no bloquea el envío', async () => {
    const user = userEvent.setup();
    const onSubmit = setup([FIRST, DOC], { firstName: 'Ana', documentId: '1001' }, false);
    expect(screen.queryByLabelText(/es menor de edad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/acudiente/i)).not.toBeInTheDocument();
    await save(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('oculto: editar a un menor ya registrado no cambia su condición ni su acudiente', async () => {
    const user = userEvent.setup();
    const onSubmit = setup(
      [FIRST, DOC],
      {
        id: 's1', firstName: 'Nico', documentId: '1012345678', documentType: 'TI', isMinor: true,
        guardianName: 'Luis', guardianDocument: '20304050',
      },
      false,
    );
    await save(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const data = onSubmit.mock.calls[0][0];
    expect(data).not.toHaveProperty('isMinor');
    expect(data).not.toHaveProperty('guardianName');
    expect(data).not.toHaveProperty('guardianDocument');
  });
});

describe('contacto de emergencia', () => {
  it('abre con el nombre y el teléfono ya guardados', () => {
    setup([FIRST, DOC, EMERGENCY], {
      id: 's1', firstName: 'Ana', documentId: '1001', emergencyName: 'Luis', emergencyPhone: '3001234567',
    });
    expect(screen.getByLabelText(/contacto de emergencia \(nombre\)/i)).toHaveValue('Luis');
    expect(screen.getByLabelText(/contacto de emergencia \(teléfono\)/i)).toHaveValue('3001234567');
  });

  it('entrega nombre y teléfono al guardar', async () => {
    const user = userEvent.setup();
    const onSubmit = setup([FIRST, DOC, EMERGENCY], { firstName: 'Ana', documentId: '1001' });
    await user.type(screen.getByLabelText(/contacto de emergencia \(nombre\)/i), 'Marta');
    await user.type(screen.getByLabelText(/contacto de emergencia \(teléfono\)/i), '31a0-99');
    await save(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // Los caracteres que no son de un teléfono no se aceptan al escribir.
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ emergencyName: 'Marta', emergencyPhone: '310-99' });
  });

  it('si es obligatorio, exige el nombre', async () => {
    const user = userEvent.setup();
    const onSubmit = setup(
      [FIRST, DOC, field('emergencyContact', 'Contacto de emergencia', { required: true })],
      { firstName: 'Ana', documentId: '1001' },
    );
    await save(user);
    expect(await screen.findByText(/es obligatorio/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('un contacto histórico sin teléfono se conserva al guardar', async () => {
    const user = userEvent.setup();
    const onSubmit = setup([FIRST, DOC, EMERGENCY], {
      id: 's1', firstName: 'Ana', documentId: '1001', emergencyName: 'Mamá', emergencyPhone: '',
    });
    await save(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ emergencyName: 'Mamá', emergencyPhone: '' });
  });
});
