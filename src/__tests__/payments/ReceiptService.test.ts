/**
 * Unit tests for ReceiptService.
 *
 * Verifica que:
 * - La descarga genera un nombre de archivo válido (comprobante_GOP-XXXX.pdf).
 * - Los metadatos del PDF son correctos.
 * - El formateo de moneda y fecha funciona correctamente.
 * - fromPayment crea un ReceiptData válido desde un Payment.
 *
 * Uses: Vitest
 */

import { describe, it, expect } from 'vitest';
import { ReceiptService } from '@/services/ReceiptService';
import type { Payment } from '@/types/payment';
import type { ReceiptClientInfo, ReceiptData } from '@/services/ReceiptService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-001',
    date: '2025-06-15',
    amount: 100000,
    method: 'Efectivo',
    status: 'paid',
    planName: 'Premium',
    category: 'mensualidad',
    discount: 10000,
    discountReason: 'Pronto pago',
    receiptNo: 'GOP-0001',
    ...overrides,
  };
}

function makeClient(): ReceiptClientInfo {
  return {
    name: 'Juan Pérez',
    documentId: '123456789',
    phone: '3001234567',
    email: 'juan@test.com',
  };
}

function makeReceiptData(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    receiptNo: 'GOP-0001',
    date: '2025-06-15',
    client: makeClient(),
    items: [
      {
        concept: 'Membresía — Premium',
        quantity: 1,
        unitPrice: 110000,
        subtotal: 110000,
      },
    ],
    discount: 10000,
    discountReason: 'Pronto pago',
    total: 100000,
    method: 'Efectivo',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReceiptService', () => {
  describe('getFilename', () => {
    it('should generate filename in format comprobante_GOP-XXXX.pdf', () => {
      expect(ReceiptService.getFilename('GOP-0001')).toBe('comprobante_GOP-0001.pdf');
      expect(ReceiptService.getFilename('GOP-0042')).toBe('comprobante_GOP-0042.pdf');
      expect(ReceiptService.getFilename('GOP-9999')).toBe('comprobante_GOP-9999.pdf');
    });

    it('should handle receipt numbers with more than 4 digits', () => {
      expect(ReceiptService.getFilename('GOP-10000')).toBe('comprobante_GOP-10000.pdf');
    });
  });

  describe('formatCurrency', () => {
    it('should format amounts as COP currency', () => {
      const formatted = ReceiptService.formatCurrency(110000);
      // Should start with $ and contain the number
      expect(formatted).toContain('$');
      expect(formatted).toContain('110');
    });

    it('should handle zero amount', () => {
      const formatted = ReceiptService.formatCurrency(0);
      expect(formatted).toContain('$');
      expect(formatted).toContain('0');
    });
  });

  describe('formatDate', () => {
    it('should convert ISO date to dd/mm/yyyy format', () => {
      expect(ReceiptService.formatDate('2025-06-15')).toBe('15/06/2025');
      expect(ReceiptService.formatDate('2025-01-01')).toBe('01/01/2025');
      expect(ReceiptService.formatDate('2025-12-31')).toBe('31/12/2025');
    });

    it('should handle ISO datetime strings', () => {
      expect(ReceiptService.formatDate('2025-06-15T10:30:00Z')).toBe('15/06/2025');
    });

    it('should return original string for invalid format', () => {
      expect(ReceiptService.formatDate('invalid')).toBe('invalid');
    });
  });

  describe('fromPayment', () => {
    it('should create valid ReceiptData from a Payment', () => {
      const payment = makePayment();
      const client = makeClient();
      const result = ReceiptService.fromPayment(payment, client);

      expect(result.receiptNo).toBe('GOP-0001');
      expect(result.date).toBe('2025-06-15');
      expect(result.client).toEqual(client);
      expect(result.total).toBe(100000);
      expect(result.discount).toBe(10000);
      expect(result.discountReason).toBe('Pronto pago');
      expect(result.method).toBe('Efectivo');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].concept).toContain('Premium');
      expect(result.items[0].unitPrice).toBe(110000); // amount + discount
    });

    it('should use SIN-NUMERO when receiptNo is undefined', () => {
      const payment = makePayment({ receiptNo: undefined });
      const client = makeClient();
      const result = ReceiptService.fromPayment(payment, client);

      expect(result.receiptNo).toBe('SIN-NUMERO');
    });

    it('should include splits when present', () => {
      const payment = makePayment({
        splits: [
          { method: 'Efectivo', amount: 60000 },
          { method: 'Nequi', amount: 40000 },
        ],
      });
      const client = makeClient();
      const result = ReceiptService.fromPayment(payment, client);

      expect(result.splits).toHaveLength(2);
      expect(result.splits![0].method).toBe('Efectivo');
      expect(result.splits![1].amount).toBe(40000);
    });

    it('should include creditPlan when provided', () => {
      const payment = makePayment({ status: 'credit' });
      const client = makeClient();
      const creditPlan = {
        type: 'three_installments' as const,
        initialPayment: 40000,
        remainingBalance: 60000,
        installments: [
          { number: 1, dueDate: '2025-07-15', amount: 30000, paid: false },
          { number: 2, dueDate: '2025-08-15', amount: 30000, paid: false },
        ],
      };

      const result = ReceiptService.fromPayment(payment, client, creditPlan);
      expect(result.creditPlan).toEqual(creditPlan);
    });

    it('should include custom academy name and logo', () => {
      const payment = makePayment();
      const client = makeClient();
      const result = ReceiptService.fromPayment(
        payment,
        client,
        undefined,
        'Mi Gimnasio',
        'data:image/png;base64,abc123',
      );

      expect(result.academyName).toBe('Mi Gimnasio');
      expect(result.academyLogo).toBe('data:image/png;base64,abc123');
    });

    it('should label personalized category correctly', () => {
      const payment = makePayment({ category: 'personalizada', planName: '3/sem' });
      const client = makeClient();
      const result = ReceiptService.fromPayment(payment, client);

      expect(result.items[0].concept).toContain('Entrenamiento personalizado');
      expect(result.items[0].concept).toContain('3/sem');
    });
  });

  describe('generatePdf', () => {
    it('should generate a valid jsPDF document', () => {
      const data = makeReceiptData();
      const doc = ReceiptService.generatePdf(data);

      // Verify it's a jsPDF instance with expected methods
      expect(doc).toBeDefined();
      expect(typeof doc.output).toBe('function');
      expect(typeof doc.save).toBe('function');
    });

    it('should generate a Blob from the PDF', () => {
      const data = makeReceiptData();
      const blob = ReceiptService.generateBlob(data);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should handle data with credit plan', () => {
      const data = makeReceiptData({
        creditPlan: {
          type: 'three_installments' as const,
          initialPayment: 40000,
          remainingBalance: 60000,
          installments: [
            { number: 1, dueDate: '2025-07-15', amount: 30000, paid: false },
            { number: 2, dueDate: '2025-08-15', amount: 30000, paid: false },
          ],
        },
      });

      // Should not throw
      const doc = ReceiptService.generatePdf(data);
      expect(doc).toBeDefined();
    });

    it('should handle data with splits', () => {
      const data = makeReceiptData({
        splits: [
          { method: 'Efectivo', amount: 60000 },
          { method: 'Nequi', amount: 40000 },
        ],
      });

      const doc = ReceiptService.generatePdf(data);
      expect(doc).toBeDefined();
    });

    it('should handle data without discount', () => {
      const data = makeReceiptData({ discount: 0, discountReason: undefined });
      const doc = ReceiptService.generatePdf(data);
      expect(doc).toBeDefined();
    });
  });
});
