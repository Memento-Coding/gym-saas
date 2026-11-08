import { describe, it, expect } from 'vitest';

import { buildReceiptRows, buildReceiptsCsv, filterReceiptRows, netAmount } from './receiptExport';
import type { Payment } from '@/types/payment';
import type { Student } from '@/types/student';

const pay = (id: string, over: Partial<Payment> = {}): Payment => ({
  id,
  date: '2026-11-05',
  amount: 100000,
  method: 'Efectivo',
  status: 'paid',
  planName: 'Básico',
  category: 'mensualidad',
  discount: 0,
  discountReason: '',
  receiptNo: `GOP-${id}`,
  ...over,
});
const student = (id: string, payments: Payment[] = []) =>
  ({ id, firstName: 'Ana', lastName: id, documentId: `10${id}`, documentType: 'CC', payments }) as unknown as Student;
const noFilter = { search: '', from: '', to: '' };

describe('buildReceiptRows', () => {
  it('une ambos orígenes sin duplicar y ordena del más reciente al más antiguo', () => {
    const local = pay('1', { date: '2026-11-01', studentId: 'a' });
    const remote = pay('2', { date: '2026-11-09', studentId: 'b' });
    const rows = buildReceiptRows([student('a', [local]), student('b')], [local, remote]);
    expect(rows.map((r) => r.payment.id)).toEqual(['2', '1']);
    expect(rows[0].client.documentId).toBe('CC 10b');
  });

  it('conserva el comprobante de un estudiante eliminado e ignora pagos sin dueño', () => {
    const rows = buildReceiptRows([], [pay('1', { studentId: 'x' }), pay('2')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].client.name).toBe('Estudiante eliminado');
  });
});

describe('filterReceiptRows', () => {
  const rows = buildReceiptRows(
    [
      student('a', [
        pay('1', { date: '2026-10-31' }),
        pay('2', { date: '2026-11-01T10:00:00Z', method: 'Nequi' }),
        pay('3', { date: '2026-11-30', splits: [{ method: 'Banco', amount: 1 }, { method: 'Efectivo', amount: 2 }] }),
      ]),
    ],
    [],
  );
  const ids = (f: Parameters<typeof filterReceiptRows>[1]) =>
    filterReceiptRows(rows, f).map((r) => r.payment.id).sort();

  it('el período incluye ambos extremos, aunque la fecha traiga hora', () => {
    expect(ids({ ...noFilter, from: '2026-11-01', to: '2026-11-30' })).toEqual(['2', '3']);
  });

  it('el método considera los pagos divididos', () => {
    expect(ids({ ...noFilter, method: 'Banco' })).toEqual(['3']);
    expect(ids({ ...noFilter, method: 'Efectivo' })).toEqual(['1', '3']);
  });

  it('busca por número, nombre o documento sin distinguir mayúsculas', () => {
    expect(ids({ ...noFilter, search: 'gop-2' })).toEqual(['2']);
    expect(ids({ ...noFilter, search: 'ANA' })).toHaveLength(3);
    expect(ids({ ...noFilter, search: 'cc 10a' })).toHaveLength(3);
    expect(ids({ ...noFilter, search: 'nadie' })).toEqual([]);
  });
});

describe('buildReceiptsCsv', () => {
  const row = (p: Payment, name = 'Ana Ruiz') => ({ payment: p, client: { name, documentId: 'CC 1' } });

  it('el total es neto del descuento', () => {
    const p = pay('1', { discount: 10000 });
    expect(netAmount(p)).toBe(90000);
    expect(buildReceiptsCsv([row(p)]).split('\r\n')[1].endsWith(';100000;10000;90000')).toBe(true);
  });

  it('neutraliza fórmulas y escapa separadores', () => {
    const csv = buildReceiptsCsv([row(pay('1', { planName: '=HYPERLINK("x")' }), 'Ruiz; "Ana"')]);
    expect(csv).toContain(`"Ruiz; ""Ana"""`);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('detalla los métodos de un pago dividido', () => {
    const csv = buildReceiptsCsv([row(pay('1', { splits: [{ method: 'Nequi', amount: 5 }, { method: 'Banco', amount: 7 }] }))]);
    expect(csv).toContain('Nequi 5, Banco 7');
  });
});
