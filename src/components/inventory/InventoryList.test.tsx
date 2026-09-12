/**
 * InventoryList.test.tsx — Cobertura de la tabla de inventario.
 *
 * Valida:
 *  - Estado vacío y de carga.
 *  - Render de productos (stock numérico) y servicios (stock "—").
 *  - Callbacks de editar / eliminar / reabastecer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InventoryList } from './InventoryList';
import type { InventoryItem } from '@/types/inventory';

const PRODUCT: InventoryItem = {
  id: 'p1',
  kind: 'product',
  name: 'Guantes',
  cost: 5000,
  price: 10000,
  stock: 8,
};

const SERVICE: InventoryItem = {
  id: 's1',
  kind: 'service',
  name: 'Asesoría',
  cost: 0,
  price: 30000,
  stock: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InventoryList — estados', () => {
  it('muestra el mensaje vacío cuando no hay ítems', () => {
    render(<InventoryList items={[]} />);
    expect(screen.getByText(/no hay ítems de inventario/i)).toBeInTheDocument();
  });

  it('muestra el estado de carga', () => {
    render(<InventoryList items={[]} loading />);
    expect(screen.getByText(/cargando inventario/i)).toBeInTheDocument();
  });
});

describe('InventoryList — render de ítems', () => {
  it('muestra el stock numérico de un producto', () => {
    render(<InventoryList items={[PRODUCT]} />);
    expect(screen.getByTestId('inventory-stock-p1')).toHaveTextContent('8');
  });

  it('muestra "—" en el stock de un servicio', () => {
    render(<InventoryList items={[SERVICE]} />);
    // El servicio no tiene testid de stock; verifica el guion en la fila.
    const row = screen.getByTestId('inventory-row-s1');
    expect(row).toHaveTextContent('—');
    expect(screen.queryByTestId('inventory-stock-s1')).toBeNull();
  });

  it('lista productos y servicios juntos', () => {
    render(<InventoryList items={[PRODUCT, SERVICE]} />);
    expect(screen.getByText('Guantes')).toBeInTheDocument();
    expect(screen.getByText('Asesoría')).toBeInTheDocument();
    expect(screen.getByText('Producto')).toBeInTheDocument();
    expect(screen.getByText('Servicio')).toBeInTheDocument();
  });
});

describe('InventoryList — acciones', () => {
  it('invoca onEdit con el ítem', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<InventoryList items={[PRODUCT]} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: /editar guantes/i }));
    expect(onEdit).toHaveBeenCalledWith(PRODUCT);
  });

  it('invoca onDelete con el ítem', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<InventoryList items={[PRODUCT]} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /eliminar guantes/i }));
    expect(onDelete).toHaveBeenCalledWith(PRODUCT);
  });

  it('muestra reabastecer solo para productos e invoca onRestock', async () => {
    const user = userEvent.setup();
    const onRestock = vi.fn();
    render(<InventoryList items={[PRODUCT, SERVICE]} onRestock={onRestock} />);

    // Solo el producto tiene botón de reabastecer.
    expect(screen.getByRole('button', { name: /reabastecer guantes/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reabastecer asesoría/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /reabastecer guantes/i }));
    expect(onRestock).toHaveBeenCalledWith(PRODUCT);
  });
});
