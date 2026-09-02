/**
 * PaymentHistory — Historial de pagos de un estudiante.
 *
 * Lista los pagos en una Table de shadcn/ui: fecha, concepto, método (Badge
 * con color semántico), total y un botón (icono) para re-descargar el
 * comprobante PDF (Req 5.5, 14.1).
 *
 * Requirements: 5.1, 5.5, 14.1
 */

import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Payment, PaymentMethod } from '@/types/payment';
import type { ReceiptClientInfo } from '@/services/ReceiptService';

interface PaymentHistoryProps {
  payments: Payment[];
  /** Datos del cliente para regenerar el comprobante. */
  client: ReceiptClientInfo;
  /** Re-descarga el comprobante PDF de un pago. */
  onDownloadReceipt: (payment: Payment, client: ReceiptClientInfo) => void;
  loading?: boolean;
}

/** Estilo de badge por método de pago (colores semánticos del design system). */
const METHOD_BADGE: Record<PaymentMethod, string> = {
  Efectivo: 'bg-success-50 text-success-700',
  Nequi: 'bg-info-50 text-info-700',
  Banco: 'bg-primary-50 text-primary-700',
};

/** Etiqueta legible por estado de pago. */
const STATUS_LABEL: Record<Payment['status'], string> = {
  paid: 'Pagado',
  upgrade: 'Mejora',
  credit: 'Crédito',
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return datePart;
}

export function PaymentHistory({
  payments,
  client,
  onDownloadReceipt,
  loading = false,
}: PaymentHistoryProps) {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead>Método</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-16 text-center">Comprobante</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Cargando pagos…
              </TableCell>
            </TableRow>
          ) : payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Este estudiante aún no tiene pagos registrados.
              </TableCell>
            </TableRow>
          ) : (
            payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="whitespace-nowrap">{formatDate(payment.date)}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{payment.planName}</span>
                    <span className="text-xs text-muted-foreground">
                      {STATUS_LABEL[payment.status]}
                      {payment.receiptNo ? ` · ${payment.receiptNo}` : ''}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {payment.splits && payment.splits.length > 0 ? (
                    <Badge variant="secondary" className="bg-secondary-100 text-secondary-700">
                      Dividido
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className={cn('border-transparent', METHOD_BADGE[payment.method])}
                    >
                      {payment.method}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCOP(payment.amount)}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Descargar comprobante ${payment.receiptNo ?? ''}`}
                    onClick={() => onDownloadReceipt(payment, client)}
                  >
                    <Download className="size-4 text-primary-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
