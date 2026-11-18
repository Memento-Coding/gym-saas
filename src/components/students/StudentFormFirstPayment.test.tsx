/**
 * StudentForm — primer pago al crear (#96).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StudentForm } from './StudentForm';
import { createStorageService, resetStorageService } from '@/services/storage/StorageService';
import type { StorageService } from '@/services/storage/StorageService';
import type { FormFieldConfig } from '@/types/settings';
import type { Student } from '@/types/student';

const FIELDS: FormFieldConfig[] = [
  { id: 'firstName', name: 'firstName', label: 'Nombres', type: 'text', required: true, isBuiltIn: true },
  { id: 'documentId', name: 'documentId', label: 'Documento', type: 'text', required: true, isBuiltIn: true },
  { id: 'planName', name: 'planName', label: 'Plan', type: 'select', required: false, isBuiltIn: true },
  { id: 'monthlyFee', name: 'monthlyFee', label: 'Mensualidad', type: 'number', required: false, isBuiltIn: true },
];
const plans = { memberships: [{ id: 'm', name: 'Mensual', price: 100000 }], personalized: [] };

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

function setup(defaultValues?: Partial<Student>, withPlans = true) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <StudentForm
      fields={FIELDS}
      plans={withPlans ? plans : undefined}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      storage={storage}
    />,
  );
  return onSubmit;
}
const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /guardar/i }));

describe('StudentForm — primer pago', () => {
  it('viene activado y con el monto del plan prellenado', () => {
    setup({ firstName: 'Ana', documentId: '1001', planName: 'Mensual' });
    expect(screen.getByLabelText(/registrar primer pago ahora/i)).toBeChecked();
    expect(screen.getByLabelText(/monto del pago/i)).toHaveValue('100000');
  });

  it('al guardar entrega los datos del pago junto al estudiante', async () => {
    const user = userEvent.setup();
    const onSubmit = setup({ firstName: 'Ana', documentId: '1001', planName: 'Mensual' });
    await save(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toMatchObject({
      amount: 100000,
      method: 'Efectivo',
      planName: 'Mensual',
      category: 'mensualidad',
    });
  });

  it('sin plan seleccionado no deja guardar con el pago activado', async () => {
    const user = userEvent.setup();
    const onSubmit = setup({ firstName: 'Ana', documentId: '1001' });
    await save(user);
    expect(await screen.findByText(/selecciona un plan para registrar el primer pago/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('bloquea letras en el monto y rechaza monto cero', async () => {
    const user = userEvent.setup();
    const onSubmit = setup({ firstName: 'Ana', documentId: '1001', planName: 'Mensual' });
    const amount = screen.getByLabelText(/monto del pago/i);
    await user.clear(amount);
    await user.type(amount, 'ab12');
    expect(amount).toHaveValue('12');
    await user.clear(amount);
    await user.type(amount, '0');
    await save(user);
    expect(await screen.findByText(/mayor a cero/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rechaza decimales y negativos en el monto', async () => {
    const user = userEvent.setup();
    const onSubmit = setup({ firstName: 'Ana', documentId: '1001', planName: 'Mensual' });
    const amount = screen.getByLabelText(/monto del pago/i);
    await user.clear(amount);
    await user.type(amount, '10.5');
    await save(user);
    expect(await screen.findByText(/solo puede contener números/i)).toBeInTheDocument();
    await user.clear(amount);
    await user.type(amount, '-5');
    await save(user);
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });

  it('desactivado: oculta los campos y envía firstPayment = null', async () => {
    const user = userEvent.setup();
    const onSubmit = setup({ firstName: 'Ana', documentId: '1001' });
    await user.click(screen.getByLabelText(/registrar primer pago ahora/i));
    expect(screen.queryByLabelText(/monto del pago/i)).not.toBeInTheDocument();
    await save(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][1]).toBeNull();
  });

  it('al editar no ofrece el primer pago', () => {
    setup({ id: 'x', firstName: 'Ana', documentId: '1001', planName: 'Mensual' });
    expect(screen.queryByLabelText(/registrar primer pago ahora/i)).not.toBeInTheDocument();
  });

  it('sin catálogo de planes no muestra la sección ni envía firstPayment', async () => {
    const user = userEvent.setup();
    const onSubmit = setup({ firstName: 'Ana', documentId: '1001' }, false);
    expect(screen.queryByLabelText(/registrar primer pago ahora/i)).not.toBeInTheDocument();
    await save(user);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]).toHaveLength(1);
  });
});
