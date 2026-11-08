/**
 * ReceiptsTab — Todos los comprobantes de pago, con filtros y descarga en lote:
 * un único PDF para archivar o imprimir y un CSV de resumen para el contador.
 */

import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePayments } from '@/hooks/usePayments';
import { useStudents } from '@/hooks/useStudents';
import {
  buildReceiptRows,
  buildReceiptsCsv,
  filterReceiptRows,
  netAmount,
} from '@/services/receiptExport';
import { todayLocalIso } from '@/utils/validation';
import type { PaymentMethod } from '@/types/payment';

const ALL_METHODS = '__all__';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('/');
}

function downloadCsv(content: string, filename: string): void {
  // El BOM hace que Excel lea bien las tildes.
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReceiptsTab() {
  const { payments, loading, downloadReceipt, downloadReceipts } = usePayments();
  const { students, isLoading } = useStudents();

  const today = todayLocalIso();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState(ALL_METHODS);

  const allRows = useMemo(() => buildReceiptRows(students, payments), [students, payments]);
  const rows = useMemo(
    () =>
      filterReceiptRows(allRows, {
        search,
        from,
        to,
        method: method === ALL_METHODS ? undefined : (method as PaymentMethod),
      }),
    [allRows, search, from, to, method],
  );

  const total = rows.reduce((sum, row) => sum + netAmount(row.payment), 0);
  const invalidRange = Boolean(from && to && from > to);
  const period = `${from || 'inicio'}_${to || 'hoy'}`;
  const isBusy = loading || isLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="receipts-from">Desde</Label>
          <Input id="receipts-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="receipts-to">Hasta</Label>
          <Input id="receipts-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="receipts-method">Método de pago</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger id="receipts-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_METHODS}>Todos</SelectItem>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
              <SelectItem value="Nequi">Nequi</SelectItem>
              <SelectItem value="Banco">Banco</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="receipts-search">Buscar</Label>
          <Input
            id="receipts-search"
            placeholder="Número, estudiante o documento"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {invalidRange
            ? 'La fecha "Desde" no puede ser posterior a "Hasta".'
            : `${rows.length} ${rows.length === 1 ? 'comprobante' : 'comprobantes'} por ${formatCOP(total)}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => downloadReceipts(rows, `comprobantes_${period}.pdf`)}
          >
            <FileText className="size-4" />
            Descargar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => downloadCsv(buildReceiptsCsv(rows), `resumen_comprobantes_${period}.csv`)}
          >
            <FileSpreadsheet className="size-4" />
            Descargar resumen para Excel
          </Button>
        </div>
      </div>

      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comprobante</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estudiante</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-16 text-center">PDF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {isBusy
                    ? 'Cargando comprobantes…'
                    : allRows.length === 0
                      ? 'Aún no hay comprobantes. Aparecerán aquí al registrar un pago.'
                      : 'Ningún comprobante coincide con estos filtros.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ payment, client }) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {payment.receiptNo ?? 'Sin número'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(payment.date)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{client.name}</span>
                      <span className="text-xs text-muted-foreground">{client.documentId}</span>
                    </div>
                  </TableCell>
                  <TableCell>{payment.planName}</TableCell>
                  <TableCell>{payment.splits?.length ? 'Dividido' : payment.method}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCOP(netAmount(payment))}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Descargar comprobante ${payment.receiptNo ?? ''}`}
                      onClick={() => downloadReceipt(payment, client)}
                    >
                      <Download className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
