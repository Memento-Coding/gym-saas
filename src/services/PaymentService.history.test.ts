import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { PaymentService, type PaymentInput } from './PaymentService';
import { createStorageService, resetStorageService } from './storage/StorageService';
import type { StorageService } from './storage/StorageService';
import { SaleService } from './SaleService';
import type { FinanceMovement } from '@/types/finance';
import type { Student } from '@/types/student';

const input: PaymentInput = {
  studentId: 's1',
  date: '2026-11-10',
  amount: 80000,
  method: 'Efectivo',
  status: 'paid',
  planName: 'Básico',
  category: 'mensualidad',
};
const student = (id: string, end: string) =>
  ({ id, subscriptionEndDate: end, payments: [] }) as unknown as Student;

describe('PaymentService — el pago llega al estudiante', () => {
  let storage: StorageService;

  beforeEach(async () => {
    localStorage.clear();
    resetStorageService();
    storage = await createStorageService();
    await storage.set('students', [student('s1', '2026-11-01'), student('s2', '2026-11-01')]);
  });

  afterEach(() => {
    localStorage.clear();
    resetStorageService();
  });

  const read = async () => (await storage.get<Student[]>('students'))!;

  it('agrega el pago al historial y extiende el vencimiento solo de ese estudiante', async () => {
    await new PaymentService(storage).registerPayment(input, {
      currentSubscriptionEndDate: '2026-11-01',
    });
    const [s1, s2] = await read();
    expect(s1.payments).toHaveLength(1);
    expect(s1.payments[0].receiptNo).toMatch(/^GOP-/);
    expect(s1.subscriptionEndDate).toBe('2026-12-10');
    expect(s2.payments).toHaveLength(0);
    expect(s2.subscriptionEndDate).toBe('2026-11-01');
  });

  it('un crédito queda en el historial sin extender el vencimiento', async () => {
    await new PaymentService(storage).registerPayment(
      { ...input, status: 'credit' },
      { currentSubscriptionEndDate: '2026-11-01' },
    );
    const [s1] = await read();
    expect(s1.payments).toHaveLength(1);
    expect(s1.subscriptionEndDate).toBe('2026-11-01');
  });

  it('el ingreso es el valor neto; en un crédito, solo el abono', async () => {
    const service = new PaymentService(storage);
    await service.registerPayment({ ...input, discount: 10000 });
    await service.registerPayment({ ...input, status: 'credit', initialPayment: 5000 });
    await service.registerPayment({ ...input, status: 'credit', initialPayment: 0 });
    const movements = (await storage.get<FinanceMovement[]>('finance_movements'))!;
    expect(movements.map((m) => m.amount)).toEqual([70000, 5000]);
    expect(movements[0]).toMatchObject({ type: 'income', category: 'Mensualidades', box: 'servicios', studentId: 's1' });
  });

  it('una venta suma su ingreso a la caja de almacén; a crédito, solo el abono', async () => {
    const sales = new SaleService(storage);
    const items = [{ inventoryId: 'i', name: 'Guantes', kind: 'product' as const, quantity: 2, unitPrice: 30000 }];
    const base = { clientType: 'external' as const, clientName: 'Luis', items, method: 'Nequi' as const };
    await sales.createSale({ ...base, type: 'cash' });
    await sales.createSale({ ...base, type: 'credit', credit: { type: 'single', initialPayment: 10000 } });
    const movements = (await storage.get<FinanceMovement[]>('finance_movements'))!;
    expect(movements.map((m) => m.amount)).toEqual([60000, 10000]);
    expect(movements[0]).toMatchObject({ category: 'Ventas', box: 'almacen' });
  });

  it('un estudiante inexistente no altera la colección', async () => {
    await new PaymentService(storage).registerPayment({ ...input, studentId: 'nadie' });
    expect((await read()).every((s) => s.payments.length === 0)).toBe(true);
  });
});
