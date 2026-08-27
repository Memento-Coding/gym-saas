/**
 * usePayments — Custom hook para el módulo de pagos de mensualidad.
 *
 * Envuelve PaymentService y ReceiptService, gestionando:
 * - Registro de pagos (con extensión de fecha, upgrade, crédito).
 * - Historial de pagos por estudiante o global.
 * - Generación y descarga de comprobantes PDF.
 * - Estado de carga y errores.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7 | 14.1, 14.2, 14.3, 14.4
 */

import { useState, useEffect, useCallback } from 'react';
import { getStorageService } from '@/services/storage';
import {
  PaymentService,
  type RegisterPaymentInput,
  type PaymentResult,
} from '@/services/PaymentService';
import { ReceiptService, type ReceiptClientInfo } from '@/services/ReceiptService';
import type { Payment, PaymentMethod } from '@/types/payment';
import type { Student } from '@/types/student';

export interface PaymentWithStudent extends Payment {
  studentId: string;
  studentName: string;
}

export interface UsePaymentsReturn {
  /** Estado de carga */
  loading: boolean;
  /** Último error */
  error: string | null;
  /** Registrar un pago de mensualidad */
  registerPayment: (input: RegisterPaymentInput) => Promise<PaymentResult | null>;
  /** Obtener historial de pagos de un estudiante */
  getPaymentHistory: (studentId: string) => Promise<Payment[]>;
  /** Obtener todos los pagos de todos los estudiantes */
  getAllPayments: () => Promise<PaymentWithStudent[]>;
  /** Registrar abono a pago a crédito */
  registerInstallmentPayment: (
    studentId: string,
    paymentId: string,
    amount: number,
    method: PaymentMethod,
    date: string,
  ) => Promise<Payment | null>;
  /** Generar y descargar comprobante PDF para un pago */
  downloadReceipt: (payment: Payment, student: Student) => string;
  /** Generar Blob del comprobante (para preview) */
  getReceiptBlob: (payment: Payment, student: Student) => Blob;
}

export function usePayments(): UsePaymentsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<PaymentService | null>(null);

  // Inicializar servicio
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        const paymentService = new PaymentService(storage);
        if (!cancelled) {
          setService(paymentService);
        }
      } catch {
        if (!cancelled) {
          setError('Error al inicializar el servicio de pagos.');
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Registrar pago
  const registerPayment = useCallback(
    async (input: RegisterPaymentInput): Promise<PaymentResult | null> => {
      if (!service) return null;
      setLoading(true);
      setError(null);

      try {
        const result = await service.registerPayment(input);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al registrar el pago.';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [service],
  );

  // Historial de pagos de un estudiante
  const getPaymentHistory = useCallback(
    async (studentId: string): Promise<Payment[]> => {
      if (!service) return [];
      try {
        return await service.getPaymentHistory(studentId);
      } catch {
        setError('Error al obtener el historial de pagos.');
        return [];
      }
    },
    [service],
  );

  // Todos los pagos
  const getAllPayments = useCallback(async (): Promise<PaymentWithStudent[]> => {
    if (!service) return [];
    try {
      return await service.getAllPayments();
    } catch {
      setError('Error al obtener los pagos.');
      return [];
    }
  }, [service]);

  // Registrar abono a crédito
  const registerInstallmentPayment = useCallback(
    async (
      studentId: string,
      paymentId: string,
      amount: number,
      method: PaymentMethod,
      date: string,
    ): Promise<Payment | null> => {
      if (!service) return null;
      setLoading(true);
      setError(null);

      try {
        const result = await service.registerInstallmentPayment(
          studentId,
          paymentId,
          amount,
          method,
          date,
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al registrar el abono.';
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [service],
  );

  // Descargar comprobante PDF
  const downloadReceipt = useCallback(
    (payment: Payment, student: Student): string => {
      const client: ReceiptClientInfo = {
        name: `${student.firstName} ${student.lastName}`,
        documentId: student.documentId,
        phone: student.phone,
        email: student.email,
      };

      const receiptData = ReceiptService.fromPayment(payment, client);
      return ReceiptService.generateAndDownload(receiptData);
    },
    [],
  );

  // Obtener Blob del PDF (para previews)
  const getReceiptBlob = useCallback(
    (payment: Payment, student: Student): Blob => {
      const client: ReceiptClientInfo = {
        name: `${student.firstName} ${student.lastName}`,
        documentId: student.documentId,
        phone: student.phone,
        email: student.email,
      };

      const receiptData = ReceiptService.fromPayment(payment, client);
      return ReceiptService.generateBlob(receiptData);
    },
    [],
  );

  return {
    loading,
    error,
    registerPayment,
    getPaymentHistory,
    getAllPayments,
    registerInstallmentPayment,
    downloadReceipt,
    getReceiptBlob,
  };
}
