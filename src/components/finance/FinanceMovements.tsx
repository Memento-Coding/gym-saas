/**
 * FinanceMovements — Historial de movimientos financieros en tabla.
 *
 * Usa el componente Table de shadcn/ui e incluye filtros visuales por Mes
 * (input month) y por Caja (Select: Servicios / Almacén). Los filtros se
 * comunican hacia arriba mediante `onFilterChange` para que el hook aplique
 * el filtrado (FinanceService.applyFilter).
 *
 * Requirements: 7.1, 7.2, 7.5
 */

import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import type { FinanceBox, FinanceFilter } from '@/services/FinanceService';
import type { FinanceMovement } from '@/types/finance';

/** Valor centinela para la opción "Todas" en el filtro de caja. */
const ALL_BOXES = '__all__';

interface FinanceMovementsProps {
  movements: FinanceMovement[];
  filter: FinanceFilter;
  onFilterChange: (filter: FinanceFilter) => void;
  loading?: boolean;
}

const TYPE_LABELS: Record<FinanceMovement['type'], string> = {
  income: 'Ingreso',
  expense: 'Egreso',
  transfer: 'Traslado',
};

const BOX_LABELS: Record<FinanceBox, string> = {
  servicios: 'Servicios',
  almacen: 'Almacén',
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  // Toma solo la parte de fecha para evitar corrimientos de zona horaria
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return datePart;
}

function TypeBadge({ type }: { type: FinanceMovement['type'] }) {
  const styles: Record<FinanceMovement['type'], string> = {
    income: 'bg-success-50 text-success-700',
    expense: 'bg-error-50 text-error-700',
    transfer: 'bg-info-50 text-info-700',
  };
  return (
    <Badge variant="secondary" className={cn('border-transparent', styles[type])}>
      {TYPE_LABELS[type]}
    </Badge>
  );
}

export function FinanceMovements({
  movements,
  filter,
  onFilterChange,
  loading = false,
}: FinanceMovementsProps) {
  const handleMonthChange = (value: string) => {
    onFilterChange({ ...filter, month: value === '' ? undefined : value });
  };

  const handleBoxChange = (value: string) => {
    onFilterChange({
      ...filter,
      box: value === ALL_BOXES ? undefined : (value as FinanceBox),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros visuales */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="finance-filter-month">Mes</Label>
          <Input
            id="finance-filter-month"
            type="month"
            value={filter.month ?? ''}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="finance-filter-box">Caja</Label>
          <Select value={filter.box ?? ALL_BOXES} onValueChange={handleBoxChange}>
            <SelectTrigger id="finance-filter-box" className="w-full sm:w-48">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_BOXES}>Todas</SelectItem>
              <SelectItem value="servicios">Servicios</SelectItem>
              <SelectItem value="almacen">Almacén</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Caja</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Cargando movimientos…
                </TableCell>
              </TableRow>
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No hay movimientos para los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(m.date)}</TableCell>
                  <TableCell>
                    <TypeBadge type={m.type} />
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">{m.concept}</TableCell>
                  <TableCell>{m.category}</TableCell>
                  <TableCell>{BOX_LABELS[m.box]}</TableCell>
                  <TableCell>{m.method ?? '—'}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-medium',
                      m.type === 'income' && 'text-success-700',
                      m.type === 'expense' && 'text-error-700',
                    )}
                  >
                    {m.type === 'expense' ? '-' : ''}
                    {formatCOP(m.amount)}
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
