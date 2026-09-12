/**
 * SaleForm.test.tsx — Cobertura del formulario de ventas.
 *
 * Valida:
 *  - Cliente requerido bloquea el registro.
 *  - Seleccionar un ítem calcula subtotal y total.
 *  - Un envío válido produce el CreateSaleInput correcto (contado).
 *  - El crédito con un servicio se rechaza (Req 9.5).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SaleForm } from './SaleForm';
import type { CreateSaleInput } from '@/services/SaleService';
import type { InventoryItem } from '@/types/inventory';

const PRODUCT: InventoryItem = {
  id: 'prod-1',
  kind: 'product',
  name: 'Guantes',
  cost: 5000,
  price: 10000,
  stock: 20,
};

const SERVICE: InventoryItem = {
  id: 'serv-1',
  kind: 'service',
  name: 'Asesoría',
  cost: 0,
  price: 30000,
  stock: null,
};

const INVENTORY = [PRODUCT, SERVICE];

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(<SaleForm inventory={INVENTORY} onSubmit={onSubmit} />);
  return { onSubmit };
}

/** Selecciona una opción en un Select de Radix identificado por su aria-label. */
async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: RegExp,
  optionName: RegExp,
) {
  await user.click(screen.getByRole('combobox', { name: triggerName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SaleForm — validación', () => {
  it('bloquea el registro si falta el cliente', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await selectOption(user, /ítem 1/i, /guantes/i);
    await user.click(screen.getByRole('button', { name: /registrar venta/i }));

    expect(await screen.findByText(/el nombre del cliente es obligatorio/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('bloquea el registro si una línea no tiene ítem seleccionado', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/cliente/i), 'Juan');
    await user.click(screen.getByRole('button', { name: /registrar venta/i }));

    // El mensaje de error vive en el <p role="alert">, no en el placeholder del select.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/selecciona un ítem en todas las líneas/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('SaleForm — cálculo de totales', () => {
  it('calcula subtotal y total al seleccionar un ítem y cantidad', async () => {
    const user = userEvent.setup();
    renderForm();

    await selectOption(user, /ítem 1/i, /guantes/i);

    const qty = screen.getByLabelText(/cantidad 1/i);
    await user.clear(qty);
    await user.type(qty, '3');

    // 3 * 10.000 = 30.000
    await waitFor(() => {
      expect(screen.getByTestId('sale-subtotal-0')).toHaveTextContent(/30\.000/);
      expect(screen.getByTestId('sale-total')).toHaveTextContent(/30\.000/);
    });
  });
});

describe('SaleForm — envío válido', () => {
  it('emite CreateSaleInput de contado con la línea correcta', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/cliente/i), 'Juan Pérez');
    await selectOption(user, /ítem 1/i, /guantes/i);

    const qty = screen.getByLabelText(/cantidad 1/i);
    await user.clear(qty);
    await user.type(qty, '2');

    await user.click(screen.getByRole('button', { name: /registrar venta/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const input = onSubmit.mock.calls[0][0] as CreateSaleInput;
    expect(input.clientName).toBe('Juan Pérez');
    expect(input.type).toBe('cash');
    expect(input.items).toHaveLength(1);
    expect(input.items[0]).toMatchObject({
      inventoryId: 'prod-1',
      name: 'Guantes',
      kind: 'product',
      quantity: 2,
      unitPrice: 10000,
    });
  });
});

describe('SaleForm — crédito con servicio', () => {
  it('rechaza registrar a crédito cuando hay un servicio', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/cliente/i), 'Ana');
    await selectOption(user, /ítem 1/i, /asesoría/i);
    await selectOption(user, /tipo de venta/i, /crédito/i);

    await user.click(screen.getByRole('button', { name: /registrar venta/i }));

    expect(
      await screen.findByText(/el crédito solo aplica para productos/i),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
