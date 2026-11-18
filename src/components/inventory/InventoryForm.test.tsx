/**
 * InventoryForm.test.tsx — Cobertura del formulario de inventario.
 *
 * Valida:
 *  - Nombre requerido bloquea el submit.
 *  - Precio/costo negativos rechazados.
 *  - Stock obligatorio y no negativo para productos.
 *  - Un producto válido produce el CreateInventoryItemInput correcto.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InventoryForm } from './InventoryForm';
import type { CreateInventoryItemInput } from '@/services/InventoryService';

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(<InventoryForm onSubmit={onSubmit} />);
  return { onSubmit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InventoryForm — validación', () => {
  it('bloquea el submit si falta el nombre', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/costo/i), '5000');
    await user.type(screen.getByLabelText(/precio/i), '10000');
    await user.type(screen.getByLabelText(/stock inicial/i), '10');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/el nombre es obligatorio/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rechaza precio negativo', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/nombre/i), 'Guantes');
    await user.type(screen.getByLabelText(/costo/i), '5000');
    await user.type(screen.getByLabelText(/precio/i), '-100');
    await user.type(screen.getByLabelText(/stock inicial/i), '10');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText(/no puede ser negativo/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rechaza stock negativo en un producto', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/nombre/i), 'Guantes');
    await user.type(screen.getByLabelText(/costo/i), '5000');
    await user.type(screen.getByLabelText(/precio/i), '10000');
    await user.type(screen.getByLabelText(/stock inicial/i), '-3');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    // integerInRange('El stock', 0, ...) → mensaje de rango.
    expect(await screen.findByText(/el stock debe estar entre/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // @adversarial
  it('@adversarial no acepta letras al escribir ni al pegar en campos numéricos', async () => {
    const user = userEvent.setup();
    renderForm();

    for (const label of [/costo/i, /precio/i, /stock inicial/i]) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      await user.type(input, 'abc');
      expect(input.value).toBe('');
      await user.click(input);
      await user.paste('12xyz34');
      expect(input.value).toBe('1234');
    }
  });

  it('@adversarial muestra el error de negativo al perder el foco (onTouched)', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/precio/i), '-100');
    await user.tab();

    expect(await screen.findByText(/no puede ser negativo/i)).toBeInTheDocument();
  });

  it('@adversarial muestra el error de decimal al perder el foco (onTouched)', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/precio/i), '10.5');
    await user.tab();

    expect(await screen.findByText(/solo puede contener números/i)).toBeInTheDocument();
  });

  it('emite CreateInventoryItemInput válido para un producto', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/nombre/i), 'Guantes');
    await user.type(screen.getByLabelText(/costo/i), '5000');
    await user.type(screen.getByLabelText(/precio/i), '10000');
    await user.type(screen.getByLabelText(/stock inicial/i), '10');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0] as CreateInventoryItemInput;
    expect(input.kind).toBe('product');
    expect(input.name).toBe('Guantes');
    expect(input.cost).toBe(5000);
    expect(input.price).toBe(10000);
    expect(input.stock).toBe(10);
  });
});

describe('InventoryForm — servicios', () => {
  it('oculta el campo de stock cuando es un servicio y emite stock null', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    // Cambiar el tipo a Servicio.
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /servicio/i }));

    // El campo de stock ya no debe estar visible.
    expect(screen.queryByLabelText(/stock inicial/i)).toBeNull();

    await user.type(screen.getByLabelText(/nombre/i), 'Asesoría');
    await user.type(screen.getByLabelText(/costo/i), '0');
    await user.type(screen.getByLabelText(/precio/i), '30000');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0] as CreateInventoryItemInput;
    expect(input.kind).toBe('service');
    expect(input.stock).toBeNull();
  });
});

describe('InventoryForm — edición y stock (#99)', () => {
  const existing = { id: 'a', kind: 'product' as const, name: 'Guantes', cost: 10, price: 20, stock: 10 };

  function renderEdit() {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<InventoryForm defaultValues={existing} onSubmit={onSubmit} />);
    return onSubmit;
  }

  it('si no se toca el stock, el payload no lo incluye', async () => {
    const user = userEvent.setup();
    const onSubmit = renderEdit();
    const name = screen.getByLabelText(/nombre/i);
    await user.clear(name);
    await user.type(name, 'Guantes Pro');
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0] as CreateInventoryItemInput;
    expect(input.name).toBe('Guantes Pro');
    expect(input).not.toHaveProperty('stock');
  });

  it('si se edita el stock, el payload lo incluye', async () => {
    const user = userEvent.setup();
    const onSubmit = renderEdit();
    const stock = screen.getByLabelText(/stock/i);
    await user.clear(stock);
    await user.type(stock, '15');
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect((onSubmit.mock.calls[0][0] as CreateInventoryItemInput).stock).toBe(15);
  });

  it('escribir de nuevo el mismo valor no cuenta como cambio', async () => {
    const user = userEvent.setup();
    const onSubmit = renderEdit();
    const stock = screen.getByLabelText(/stock/i);
    await user.clear(stock);
    await user.type(stock, '10');
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('stock');
  });
});
