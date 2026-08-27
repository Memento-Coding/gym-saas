/**
 * PaymentHistory — Tabla de historial de pagos con opción de re-descargar comprobante PDF.
 *
 * Funcionalidades:
 * - Tabla responsiva con datos de pagos (fecha, plan, monto, método, estado, comprobante).
 * - Badge de color por estado (pagado, upgrade, crédito).
 * - Botón para descargar el comprobante PDF de cada pago.
 * - Indicador de descuento cuando aplica.
 * - Soporte para pagos divididos (muestra los splits).
 *
 * Requirements: 5.7, 14.4
 */

import { useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Payment } from '@/types/payment';
import type { Student } from '@/types/student';
import { ReceiptService, type ReceiptClientInfo } from '@/services/ReceiptService';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface PaymentHistoryProps {
  /** Lista de pagos a mostrar */
  payments: Payment[];
  /** Estudiante dueño de los pagos (para generar PDF) */
  student: Student;
  /** Estado de carga */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const parts = iso.split('T')[0].split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

function getStatusBadge(status: Payment['status']) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Pagado</Badge>;
    case 'upgrade':
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Upgrade</Badge>;
    case 'credit':
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Crédito</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getMethodDisplay(payment: Payment): string {
  if (payment.splits && payment.splits.length > 0) {
    return payment.splits.map((s) => `${s.method}: ${formatCurrency(s.amount)}`).join(' | ');
  }
  return payment.method;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function PaymentHistory({ payments, student, loading = false }: PaymentHistoryProps) {
  // Ordenar por fecha descendente (más reciente primero)
  const sortedPayments = useMemo(
    () =>
      [...payments].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [payments],
  );

  // Descargar comprobante PDF
  const handleDownloadReceipt = useCallback(
    (payment: Payment) => {
      const client: ReceiptClientInfo = {
        name: `${student.firstName} ${student.lastName}`,
        documentId: student.documentId,
        phone: student.phone,
        email: student.email,
      };

      const receiptData = ReceiptService.fromPayment(payment, client);
      ReceiptService.generateAndDownload(receiptData);
    },
    [student],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Cargando historial de pagos...</p>
      </div>
    );
  }

  if (sortedPayments.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-12">
        <p className="text-sm text-muted-foreground">
          No hay pagos registrados para este estudiante.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Historial de pagos ({sortedPayments.length})
        </h3>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPayments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="text-sm">
                {formatDate(payment.date)}
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs text-muted-foreground">
                  {payment.receiptNo ?? '—'}
                </span>
              </TableCell>
              <TableCell>
                <div>
                  <span className="text-sm">{payment.planName}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({payment.category === 'mensualidad' ? 'Grupal' : 'Personal'})
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {formatCurrency(payment.amount)}
                  </span>
                  {payment.discount > 0 && (
                    <span className="text-xs text-red-600 dark:text-red-400">
                      -{formatCurrency(payment.discount)}
                      {payment.discountReason && ` (${payment.discountReason})`}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">{getMethodDisplay(payment)}</span>
              </TableCell>
              <TableCell>{getStatusBadge(payment.status)}</TableCell>
              <TableCell className="text-right">
                {payment.receiptNo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadReceipt(payment)}
                    title="Descargar comprobante PDF"
                    aria-label={`Descargar comprobante ${payment.receiptNo}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-1"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    PDF
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
