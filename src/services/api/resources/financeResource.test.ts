import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinanceMovement } from '@/types/finance';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../apiClient', () => ({ api: { get, post, put: vi.fn(), delete: vi.fn() } }));

import { FinanceResource } from './financeResource';

const leg = (id: string, box: FinanceMovement['box'], transferTo: string): FinanceMovement => ({
  id, type: 'transfer', date: '2026-11-08', concept: 'Traslado', category: 'Traslado', amount: 5000, box, transferTo,
});

describe('FinanceResource.set', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue([{ id: 'old' }]);
    post.mockReset().mockResolvedValue({});
  });

  it('un traslado nuevo hace un solo POST a /finance/transfers, del origen al destino', async () => {
    await new FinanceResource().set([leg('a', 'servicios', 'b'), leg('b', 'almacen', 'a')]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/finance/transfers', expect.objectContaining({
      fromAccount: 'servicios', toAccount: 'almacen', amount: 5000,
    }));
  });

  it('no reenvía lo que ya está en la API y publica ingresos en /finance/movements', async () => {
    const income: FinanceMovement = { id: 'new', type: 'income', date: '2026-11-08', concept: 'X', category: 'C', amount: 1, box: 'servicios' };
    await new FinanceResource().set([{ ...income, id: 'old' }, income]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/finance/movements', expect.objectContaining({ type: 'income', account: 'servicios', note: 'X' }));
  });
});
