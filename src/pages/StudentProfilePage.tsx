/**
 * StudentProfilePage — Perfil individual de un estudiante (ruta /estudiantes/:id).
 *
 * Carga el estudiante por id desde StudentService y muestra:
 *  - Datos básicos (nombre, documento, plan, vencimiento).
 *  - Registro de pagos (PaymentForm), que extiende la membresía.
 *  - Historial de pagos (PaymentHistory) con descarga de comprobante PDF
 *    (ReceiptService) — Req 14.1.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { isApiMode } from '@/config/env';
import { studentService } from '@/services/StudentService';
import type { PaymentInput } from '@/services/PaymentService';
import { usePayments } from '@/hooks/usePayments';
import { useMemberships } from '@/hooks/useMemberships';
import type { Student } from '@/types/student';
import type { ReceiptClientInfo } from '@/services/ReceiptService';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PaymentForm } from '@/components/payments/PaymentForm';
import { PaymentHistory } from '@/components/payments/PaymentHistory';
import { formatDate } from '@/components/students/studentStatus';

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { payments, registerPayment, downloadReceipt } = usePayments();
  const { groupPlans, personalizedPlans } = useMemberships();

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const result = await studentService.getById(id);
      if (!cancelled) {
        setStudent(result);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Perfil del Estudiante</h1>
        <p className="text-muted-foreground">Cargando estudiante…</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Perfil del Estudiante</h1>
        <p className="text-muted-foreground">
          No se encontró un estudiante con ID: {id}
        </p>
      </div>
    );
  }

  const client: ReceiptClientInfo = {
    name: `${student.firstName} ${student.lastName}`,
    documentId: student.documentId,
    phone: student.phone,
    email: student.email,
  };

  const handlePayment = async (input: PaymentInput) => {
    setSaving(true);
    const result = await registerPayment(input, {
      client,
      currentSubscriptionEndDate: student.subscriptionEndDate,
      plan: [...groupPlans, ...personalizedPlans].find((p) => p.name === input.planName),
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Pago registrado. Recibo ${result.data.receiptNo}.`);
    setPaymentOpen(false);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {student.firstName} {student.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Documento: {student.documentId || '—'} · Plan: {student.planName || '—'} ·
          {' '}Vencimiento: {formatDate(student.subscriptionEndDate)}
        </p>
        </div>
        <Button onClick={() => setPaymentOpen(true)}>Registrar pago</Button>
      </header>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              Al confirmar se descarga el comprobante en PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <PaymentForm studentId={student.id} onSubmit={handlePayment} submitting={saving} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Historial de pagos + descarga de comprobante */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Historial de pagos</h2>
        <PaymentHistory
          payments={
            isApiMode()
              ? payments.filter((p) => p.studentId === student.id)
              : (student.payments ?? [])
          }
          client={client}
          onDownloadReceipt={downloadReceipt}
        />
      </section>
    </div>
  );
}
