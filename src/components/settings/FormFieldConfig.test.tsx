import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FormFieldConfigEditor } from './FormFieldConfig';
import type { FormFieldConfig } from '@/types/settings';

const talla: FormFieldConfig = {
  id: 'f1', name: 'custom_talla', label: 'Talla', type: 'text', required: false, isBuiltIn: false,
};

function renderEditor(fields: FormFieldConfig[] = []) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<FormFieldConfigEditor fields={fields} onSave={onSave} />);
  return onSave;
}

describe('FormFieldConfigEditor', () => {
  it('dejar de pedir un campo lo quita y guarda la configuración completa', async () => {
    const user = userEvent.setup();
    const onSave = renderEditor();

    await user.click(screen.getByRole('checkbox', { name: /pedir teléfono/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0].map((f: FormFieldConfig) => f.name);
    expect(saved).toContain('firstName');
    expect(saved).not.toContain('phone');
  });

  it('los campos bloqueados no se pueden desactivar', () => {
    renderEditor();
    expect(screen.queryByRole('checkbox', { name: /pedir nombres/i })).toBeNull();
    expect(screen.getAllByText(/siempre obligatorio/i)).toHaveLength(5);
  });

  it('renombrar conserva la clave donde están los datos', async () => {
    const user = userEvent.setup();
    const onSave = renderEditor([talla]);
    const row = screen.getAllByText('Talla')[0].parentElement!.parentElement!;

    await user.click(row.querySelectorAll('button')[1]);
    const input = screen.getByDisplayValue('Talla');
    await user.clear(input);
    await user.type(input, 'Talla de camiseta');
    await user.click(input.parentElement!.querySelectorAll('button')[1]);

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0].find((f: FormFieldConfig) => f.id === 'f1');
    expect(saved).toMatchObject({ name: 'custom_talla', label: 'Talla de camiseta' });
  });

  it('rechaza un nombre repetido y genera claves seguras', async () => {
    const user = userEvent.setup();
    const onSave = renderEditor([talla]);

    await user.click(screen.getByRole('button', { name: /agregar campo/i }));
    await user.type(screen.getByPlaceholderText(/nombre del campo/i), 'talla');
    await user.click(screen.getByRole('button', { name: /^agregar$/i }));
    expect(onSave).not.toHaveBeenCalled();

    const name = screen.getByPlaceholderText(/nombre del campo/i);
    await user.clear(name);
    await user.type(name, 'Número vs. peso');
    await user.click(screen.getByRole('button', { name: /^agregar$/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const added = onSave.mock.calls[0][0].at(-1);
    expect(added.name).toBe('custom_numero_vs_peso');
  });
});

describe('FormFieldConfigEditor — orden, nombres y solo adultos (#100)', () => {
  const savedNames = (onSave: ReturnType<typeof vi.fn>, call = 0) =>
    onSave.mock.calls[call][0].map((f: FormFieldConfig) => f.name);

  it('subir un campo cambia su posición y guarda el nuevo orden', async () => {
    const user = userEvent.setup();
    const onSave = renderEditor();
    await user.click(screen.getByRole('button', { name: 'Subir Apellidos' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const names = savedNames(onSave);
    expect(names.indexOf('lastName')).toBeLessThan(names.indexOf('firstName'));
  });

  it('bajar un campo propio lo mueve entre los del sistema', async () => {
    const user = userEvent.setup();
    const onSave = renderEditor([talla]);
    await user.click(screen.getByRole('button', { name: 'Subir Talla' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const names = savedNames(onSave);
    expect(names.indexOf('custom_talla')).toBe(names.length - 2);
  });

  it('el primero no se puede subir ni el último bajar', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: 'Subir Nombres' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar Vencimiento' })).toBeDisabled();
  });

  it('renombrar un campo del sistema guarda la etiqueta y conserva la clave', async () => {
    const user = userEvent.setup();
    const onSave = renderEditor();
    await user.click(screen.getByRole('button', { name: 'Renombrar Teléfono' }));
    const input = screen.getByLabelText('Nuevo nombre de Teléfono');
    await user.clear(input);
    await user.type(input, 'Celular');
    await user.click(screen.getByRole('button', { name: 'Guardar nombre de Teléfono' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0].find((f: FormFieldConfig) => f.name === 'phone');
    expect(saved).toMatchObject({ name: 'phone', id: 'phone', label: 'Celular' });
  });

  it('dejar el nombre vacío vuelve al original', async () => {
    const user = userEvent.setup();
    const onSave = renderEditor([{ ...talla, id: 'x', name: 'custom_x' }]);
    await user.click(screen.getByRole('button', { name: 'Renombrar Teléfono' }));
    await user.clear(screen.getByLabelText('Nuevo nombre de Teléfono'));
    await user.click(screen.getByRole('button', { name: 'Guardar nombre de Teléfono' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].find((f: FormFieldConfig) => f.name === 'phone').label).toBe('Teléfono');
  });

  it('rechaza un nombre que ya usa otro campo', async () => {
    const user = userEvent.setup();
    const onSave = renderEditor();
    await user.click(screen.getByRole('button', { name: 'Renombrar Teléfono' }));
    const input = screen.getByLabelText('Nuevo nombre de Teléfono');
    await user.clear(input);
    await user.type(input, 'email');
    await user.click(screen.getByRole('button', { name: 'Guardar nombre de Teléfono' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('activar "solo adultos" guarda la marca y desactivarlo la quita', async () => {
    const user = userEvent.setup();
    const onSave = renderEditor();
    await user.click(screen.getByLabelText(/solo atiendo adultos/i));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(savedNames(onSave, 0)).toContain('adultsOnly');
    await user.click(screen.getByLabelText(/solo atiendo adultos/i));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(savedNames(onSave, 1)).not.toContain('adultsOnly');
  });

  it('abre con "solo adultos" marcado si ya estaba guardado y no lo pierde al editar otra cosa', async () => {
    const user = userEvent.setup();
    const adults: FormFieldConfig = {
      id: 'adultsOnly', name: 'adultsOnly', label: 'Solo adultos', type: 'text', required: false, isBuiltIn: true,
    };
    const onSave = renderEditor([adults]);
    expect(screen.getByLabelText(/solo atiendo adultos/i)).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /pedir teléfono/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(savedNames(onSave)).toContain('adultsOnly');
  });

  it('el contacto de emergencia se puede activar como cualquier campo del sistema', async () => {
    const user = userEvent.setup();
    const onSave = renderEditor();
    await user.click(screen.getByRole('checkbox', { name: /pedir contacto de emergencia/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(savedNames(onSave)).toContain('emergencyContact');
  });
});
