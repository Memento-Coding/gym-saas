/**
 * usePayments — Custom hook para el módulo de pagos.
 *
 * Envuelve el PaymentService, gestiona estado (historial, loading, error) y
 * ofrece la descarga de comprobantes con los datos del gimnasio.
 *
 * Requirements: 5.1, 5.3, 5.4, 5.5, 5.6, 5.7, 14.1
 */

import { useState, useEffect, useCallback } from 'react';
import { getStorageService } from '@/services/storage';
import {
  computeSubscriptionEndDate,
  PaymentService,
  type PaymentInput,
  type RegisterPaymentResult,
  type ServiceResult,
} from '@/services/PaymentService';
import {
  ReceiptService,
  receiptBranding,
  type ReceiptClientInfo,
} from '@/services/ReceiptService';
import type { ReceiptRow } from '@/services/receiptExport';
import type { BrandingConfig } from '@/types/settings';
import type { Payment } from '@/types/payment';
import { isApiMode } from '@/config/env';
import { createApiPayment } from '@/services/api';
import { buildCreditPlan } from '@/services/SaleService';

interface RegisterOptions {
  /** Contexto para el cálculo de extensión de vencimiento. */
  currentSubscriptionEndDate?: string;
  plan?: { single?: boolean };
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
  /** Descarga varios comprobantes en un único PDF. */
  downloadReceipts: (rows: ReceiptRow[], filename: string) => void;
}

export function usePayments(): UsePaymentsReturn {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<PaymentService | null>(null);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  // Inicializa el servicio una sola vez.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        const paymentSvc = new PaymentService(storage);
        const brandingData = await storage.get<BrandingConfig>('branding');
        if (!cancelled) {
          setService(paymentSvc);
          setBranding(brandingData);
        }
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

      // ─── Modo API: el backend registra el pago, genera el recibo (GOP-XXXX)
      //     y extiende la membresía. Construimos un Payment con los datos del
      //     input y lo enviamos con el studentId. ───
      if (isApiMode()) {
        try {
          const draft: Payment = {
            id: '',
            date: input.date,
            amount: input.amount,
            method: input.method,
            splits: input.splits,
            status: input.status,
            planName: input.planName,
            category: input.category,
            discount: input.discount ?? 0,
            discountReason: input.discountReason ?? '',
          };
          const netAmount = input.amount - (input.discount ?? 0);
          const plan =
            input.status === 'credit'
              ? buildCreditPlan(netAmount, input.initialPayment ?? 0, {
                  type: input.creditPlan?.type ?? 'single',
                })
              : undefined;
          const newEndDate = options.currentSubscriptionEndDate
            ? computeSubscriptionEndDate(
                options.currentSubscriptionEndDate,
                input.date,
                input.status,
                options.plan,
              )
            : undefined;
          const created = await createApiPayment(draft, input.studentId, {
            extensionDate:
              newEndDate !== options.currentSubscriptionEndDate ? newEndDate : undefined,
            credit: plan && {
              initialDown: input.initialPayment ?? 0,
              installments: plan.installments.map(({ number, amount, dueDate }) => ({
                number,
                amount,
                dueDate,
              })),
            },
          });
          const result: ServiceResult<RegisterPaymentResult> = {
            success: true,
            data: { payment: created, receiptNo: created.receiptNo ?? '' },
          };

          await refreshData();
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error al registrar el pago.';
          setError(message);
          return { success: false, error: message };
        }
      }

      const result = await service.registerPayment(input, {
        currentSubscriptionEndDate: options.currentSubscriptionEndDate,
        plan: options.plan,
      });

      if (!result.success) {
        setError(result.error);
        return result;
      }

      await refreshData();
      return result;
    },
    [service, refreshData],
  );

  const downloadReceipt = useCallback(
    (payment: Payment, client: ReceiptClientInfo) => {
      ReceiptService.generateAndDownload({
        ...ReceiptService.fromPayment(payment, client),
        ...receiptBranding(branding),
      });
    },
    [branding],
  );

  const downloadReceipts = useCallback(
    (rows: ReceiptRow[], filename: string) => {
      ReceiptService.generateBatchPdf(
        rows.map((row) => ({
          ...ReceiptService.fromPayment(row.payment, row.client),
          ...receiptBranding(branding),
        })),
      ).save(filename);
    },
    [branding],
  );

  return {
    payments,
    loading,
    error,
    refreshData,
    registerPayment,
    downloadReceipt,
    downloadReceipts,
  };
}
