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
    const row = screen.getByText('Talla').parentElement!.parentElement!;

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
