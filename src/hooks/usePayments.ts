/**
 * usePayments — Custom hook para el módulo de pagos.
 *
 * Envuelve el PaymentService, gestiona estado (historial, loading, error) y,
 * al registrar un pago exitosamente, dispara la descarga del comprobante PDF
 * mediante ReceiptService.
 *
 * Requirements: 5.1, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1
 */

import { useState, useEffect, useCallback } from 'react';
import { getStorageService } from '@/services/storage';
import {
  PaymentService,
  type PaymentInput,
  type RegisterPaymentResult,
  type ServiceResult,
} from '@/services/PaymentService';
import {
  ReceiptService,
  type ReceiptClientInfo,
} from '@/services/ReceiptService';
import type { Payment } from '@/types/payment';

interface RegisterOptions {
  /** Datos del cliente para el comprobante (Req 14.1). */
  client: ReceiptClientInfo;
  /** Contexto para el cálculo de extensión de vencimiento. */
  currentSubscriptionEndDate?: string;
  plan?: { single?: boolean };
  /** Si false, no se descarga el comprobante automáticamente. Por defecto true. */
  downloadReceipt?: boolean;
  /** Personalización de marca para el comprobante. */
  academyName?: string;
  academyLogo?: string;
}

interface UsePaymentsReturn {
  payments: Payment[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  /** Historial de pagos filtrado (por ahora, todos; el vínculo por estudiante se hará en Fase 2). */
  registerPayment: (
    input: PaymentInput,
    options: RegisterOptions,
  ) => Promise<ServiceResult<RegisterPaymentResult>>;
  /** Re-descarga el comprobante PDF de un pago existente. */
  downloadReceipt: (payment: Payment, client: ReceiptClientInfo) => void;
}

export function usePayments(): UsePaymentsReturn {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<PaymentService | null>(null);

  // Inicializa el servicio una sola vez.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        const paymentSvc = new PaymentService(storage);
        if (!cancelled) setService(paymentSvc);
      } catch {
        if (!cancelled) {
          setError('Error al inicializar el servicio de pagos.');
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!service) return;
    setLoading(true);
    setError(null);
    try {
      const data = await service.getAll();
      setPayments(data);
    } catch {
      setError('Error al cargar el historial de pagos.');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (service) refreshData();
  }, [service, refreshData]);

  const registerPayment = useCallback(
    async (
      input: PaymentInput,
      options: RegisterOptions,
    ): Promise<ServiceResult<RegisterPaymentResult>> => {
      if (!service) {
        return { success: false, error: 'El servicio de pagos no está listo.' };
      }
      setError(null);

      const result = await service.registerPayment(input, {
        currentSubscriptionEndDate: options.currentSubscriptionEndDate,
        plan: options.plan,
      });

      if (!result.success) {
        setError(result.error);
        return result;
      }

      // Descarga del comprobante PDF al registrar con éxito (Req 14.1).
      if (options.downloadReceipt !== false) {
        try {
          const receiptData = ReceiptService.fromPayment(
            result.data.payment,
            options.client,
            undefined,
            options.academyName,
            options.academyLogo,
          );
          ReceiptService.generateAndDownload(receiptData);
        } catch {
          // No bloqueamos el registro si la generación del PDF falla.
          setError('El pago se registró, pero no se pudo generar el comprobante.');
        }
      }

      await refreshData();
      return result;
    },
    [service, refreshData],
  );

  const downloadReceipt = useCallback((payment: Payment, client: ReceiptClientInfo) => {
    const receiptData = ReceiptService.fromPayment(payment, client);
    ReceiptService.generateAndDownload(receiptData);
  }, []);

  return {
    payments,
    loading,
    error,
    refreshData,
    registerPayment,
    downloadReceipt,
  };
}
