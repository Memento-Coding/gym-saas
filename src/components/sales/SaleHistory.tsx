/**
 * SaleHistory — Tabla del historial de ventas realizadas.
 *
 * Columnas: Fecha, Cliente, Ítems, Tipo (contado/crédito), Total, Comprobante.
 *
 * Requirements: 9.1
 */

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Sale } from '@/types/sale';

export interface SaleHistoryProps {
  sales: Sale[];
  loading?: boolean;
}

const TYPE_LABEL: Record<Sale['type'], string> = {
  cash: 'Contado',
  credit: 'Crédito',
};

const TYPE_BADGE: Record<Sale['type'], string> = {
  cash: 'bg-success-50 text-success-700',
  credit: 'bg-info-50 text-info-700',
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso.slice(0, 10);
}

export function SaleHistory({ sales, loading = false }: SaleHistoryProps) {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="text-center">Ítems</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Comprobante</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Cargando ventas…
              </TableCell>
            </TableRow>
          ) : sales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Aún no se han registrado ventas.
              </TableCell>
            </TableRow>
          ) : (
            sales.map((sale) => (
              <TableRow key={sale.id} data-testid={`sale-row-${sale.id}`}>
                <TableCell className="whitespace-nowrap">{formatDate(sale.date)}</TableCell>
                <TableCell className="font-medium">{sale.clientName}</TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {sale.items.reduce((acc, it) => acc + it.quantity, 0)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn('border-transparent', TYPE_BADGE[sale.type])}
                  >
                    {TYPE_LABEL[sale.type]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCOP(sale.total)}
                </TableCell>
                <TableCell className="text-muted-foreground">{sale.receiptNo}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
