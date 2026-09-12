/**
 * InventoryList — Tabla de ítems de inventario (productos y servicios).
 *
 * Columnas: Nombre, Tipo, Stock, Costo, Precio, Acciones (editar / eliminar).
 * Los servicios muestran "—" en la columna de stock (no manejan stock físico).
 *
 * Requirements: 8.1, 8.5
 */

import { Pencil, Trash2, PackagePlus } from 'lucide-react';
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
import type { InventoryItem } from '@/types/inventory';

export interface InventoryListProps {
  items: InventoryItem[];
  loading?: boolean;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: (item: InventoryItem) => void;
  onRestock?: (item: InventoryItem) => void;
}

const KIND_LABEL: Record<InventoryItem['kind'], string> = {
  product: 'Producto',
  service: 'Servicio',
};

const KIND_BADGE: Record<InventoryItem['kind'], string> = {
  product: 'bg-primary-50 text-primary-700',
  service: 'bg-info-50 text-info-700',
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Umbral de stock bajo para resaltar visualmente. */
const LOW_STOCK_THRESHOLD = 5;

export function InventoryList({
  items,
  loading = false,
  onEdit,
  onDelete,
  onRestock,
}: InventoryListProps) {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Costo</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="w-28 text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Cargando inventario…
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No hay ítems de inventario registrados.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const isProduct = item.kind === 'product';
              const lowStock =
                isProduct && item.stock !== null && item.stock <= LOW_STOCK_THRESHOLD;
              return (
                <TableRow key={item.id} data-testid={`inventory-row-${item.id}`}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn('border-transparent', KIND_BADGE[item.kind])}
                    >
                      {KIND_LABEL[item.kind]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.stock === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn('font-medium', lowStock && 'text-error-700')}
                        data-testid={`inventory-stock-${item.id}`}
                      >
                        {item.stock}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCOP(item.cost)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCOP(item.price)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {isProduct && onRestock && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Reabastecer ${item.name}`}
                          onClick={() => onRestock(item)}
                        >
                          <PackagePlus className="size-4 text-primary-600" />
                        </Button>
                      )}
                      {onEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar ${item.name}`}
                          onClick={() => onEdit(item)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Eliminar ${item.name}`}
                          onClick={() => onDelete(item)}
                        >
                          <Trash2 className="size-4 text-error-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
