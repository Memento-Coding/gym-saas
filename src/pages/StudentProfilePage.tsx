/**
 * StudentProfilePage — Perfil individual de un estudiante (ruta /estudiantes/:id).
 *
 * Carga el estudiante por id desde StudentService y muestra:
 *  - Datos básicos (nombre, documento, plan, vencimiento).
 *  - Historial de pagos (PaymentHistory) con descarga de comprobante PDF
 *    (ReceiptService) — Req 14.1.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { studentService } from '@/services/StudentService';
import { usePayments } from '@/hooks/usePayments';
import type { Student } from '@/types/student';
import type { ReceiptClientInfo } from '@/services/ReceiptService';

import { PaymentHistory } from '@/components/payments/PaymentHistory';
import { formatDate } from '@/components/students/studentStatus';

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { downloadReceipt } = usePayments();

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [id]);

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

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera */}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {student.firstName} {student.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Documento: {student.documentId || '—'} · Plan: {student.planName || '—'} ·
          {' '}Vencimiento: {formatDate(student.subscriptionEndDate)}
        </p>
      </header>

      {/* Historial de pagos + descarga de comprobante */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Historial de pagos</h2>
        <PaymentHistory
          payments={student.payments ?? []}
          client={client}
          onDownloadReceipt={downloadReceipt}
        />
      </section>
    </div>
  );
}
