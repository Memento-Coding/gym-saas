/**
 * SaleForm — Formulario para registrar ventas de contado o crédito.
 *
 * Permite añadir múltiples líneas de ítems seleccionados del inventario,
 * calcula subtotales y total en vivo, y refleja que el stock se descontará al
 * registrar (el descuento real lo hace useSales → InventoryService.applySale).
 *
 * Reglas de negocio (respaldadas por SaleService):
 *  - El crédito solo admite productos (se bloquea si hay servicios).
 *  - Cada línea debe seleccionar un ítem del inventario y una cantidad > 0.
 *
 * Componente presentacional/controlado: recibe el inventario y onSubmit; la
 * persistencia y el descuento de stock los hace el padre vía useSales.
 *
 * Requirements: 9.1, 9.2, 9.4
 */

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

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
import { cn } from '@/lib/utils';
import { CreditPlanEditor } from '@/components/sales/CreditPlanEditor';
import { computeSaleTotal } from '@/services/SaleService';
import type { CreateSaleInput, SaleLineInput, CreditPlanInput } from '@/services/SaleService';
import type { InventoryItem } from '@/types/inventory';
import type { PaymentMethod } from '@/types/payment';

const METHODS: PaymentMethod[] = ['Efectivo', 'Nequi', 'Banco'];

const SALE_TYPES = [
  { value: 'cash', label: 'Contado' },
  { value: 'credit', label: 'Crédito (cuotas)' },
] as const;

/** Línea del formulario (antes de ensamblar CreateSaleInput). */
interface FormLine {
  inventoryId: string;
  quantity: string;
}

export interface SaleFormProps {
  /** Ítems de inventario disponibles para vender. */
  inventory: InventoryItem[];
  onSubmit: (input: CreateSaleInput) => Promise<void> | void;
  submitting?: boolean;
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function emptyLine(): FormLine {
  return { inventoryId: '', quantity: '1' };
}

export function SaleForm({ inventory, onSubmit, submitting = false }: SaleFormProps) {
  const [clientName, setClientName] = useState('');
  const [lines, setLines] = useState<FormLine[]>([emptyLine()]);
  const [saleType, setSaleType] = useState<'cash' | 'credit'>('cash');
  const [method, setMethod] = useState<PaymentMethod>('Efectivo');
  const [credit, setCredit] = useState<CreditPlanInput>({ type: 'single', initialPayment: 0 });
  const [error, setError] = useState<string | null>(null);

  const itemsById = useMemo(
    () => new Map(inventory.map((i) => [i.id, i])),
    [inventory],
  );

  // Líneas resueltas contra el inventario para calcular subtotales/total.
  const resolvedLines = useMemo(
    () =>
      lines.map((line) => {
        const item = line.inventoryId ? itemsById.get(line.inventoryId) ?? null : null;
        const qty = Number(line.quantity) || 0;
        const unitPrice = item?.price ?? 0;
        return { line, item, qty, unitPrice, subtotal: qty * unitPrice };
      }),
    [lines, itemsById],
  );

  const total = useMemo(
    () => computeSaleTotal(resolvedLines.map((r) => ({ quantity: r.qty, unitPrice: r.unitPrice }))),
    [resolvedLines],
  );

  const hasService = resolvedLines.some((r) => r.item?.kind === 'service');

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) =>
    setLines((prev) => prev.filter((_, i) => i !== index));
  const updateLine = (index: number, patch: Partial<FormLine>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const handleSaleTypeChange = (value: 'cash' | 'credit') => {
    setSaleType(value);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    // Cliente requerido.
    if (clientName.trim() === '') {
      setError('El nombre del cliente es obligatorio.');
      return;
    }

    // Validar líneas: ítem seleccionado y cantidad entera > 0.
    const saleLines: SaleLineInput[] = [];
    for (const r of resolvedLines) {
      if (!r.item) {
        setError('Selecciona un ítem en todas las líneas.');
        return;
      }
      if (!Number.isInteger(r.qty) || r.qty <= 0) {
        setError(`La cantidad de "${r.item.name}" debe ser un entero mayor a 0.`);
        return;
      }
      saleLines.push({
        inventoryId: r.item.id,
        name: r.item.name,
        kind: r.item.kind,
        quantity: r.qty,
        unitPrice: r.unitPrice,
      });
    }

    if (saleLines.length === 0) {
      setError('La venta debe incluir al menos un ítem.');
      return;
    }

    // Crédito no admite servicios (Req 9.5).
    if (saleType === 'credit' && hasService) {
      setError('El crédito solo aplica para productos, no para servicios.');
      return;
    }

    // Crédito: validar abono inicial dentro de rango.
    if (saleType === 'credit') {
      const initial = credit.initialPayment ?? 0;
      if (initial < 0 || initial > total) {
        setError('El abono inicial debe estar entre 0 y el total de la venta.');
        return;
      }
    }

    const input: CreateSaleInput = {
      clientType: 'external',
      clientName: clientName.trim(),
      items: saleLines,
      type: saleType,
      method,
      credit: saleType === 'credit' ? credit : undefined,
    };

    await onSubmit(input);

    // Reset tras registrar.
    setClientName('');
    setLines([emptyLine()]);
    setSaleType('cash');
    setMethod('Efectivo');
    setCredit({ type: 'single', initialPayment: 0 });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Cliente */}
      <div className="grid gap-1.5">
        <Label htmlFor="sale-client">
          Cliente <span className="text-destructive">*</span>
        </Label>
        <Input
          id="sale-client"
          placeholder="Nombre del cliente"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />
      </div>

      {/* Líneas de ítems */}
      <div className="flex flex-col gap-3 rounded-lg ring-1 ring-foreground/10 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Ítems</p>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="size-4" />
            Agregar ítem
          </Button>
        </div>

        {resolvedLines.map((r, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="grid flex-1 gap-1.5">
              <Label className="text-xs text-muted-foreground">Ítem</Label>
              <Select
                value={r.line.inventoryId}
                onValueChange={(v) => updateLine(index, { inventoryId: v })}
              >
                <SelectTrigger className="w-full" aria-label={`Ítem ${index + 1}`}>
                  <SelectValue placeholder="Selecciona un ítem" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} — {formatCOP(item.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-24 gap-1.5">
              <Label className="text-xs text-muted-foreground">Cantidad</Label>
              <Input
                type="text"
                inputMode="numeric"
                aria-label={`Cantidad ${index + 1}`}
                value={r.line.quantity}
                onChange={(e) => updateLine(index, { quantity: e.target.value })}
              />
            </div>

            <div className="grid w-28 gap-1.5">
              <Label className="text-xs text-muted-foreground">Subtotal</Label>
              <span className="flex h-9 items-center text-sm font-medium" data-testid={`sale-subtotal-${index}`}>
                {formatCOP(r.subtotal)}
              </span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar ítem"
              onClick={() => removeLine(index)}
              disabled={lines.length <= 1}
            >
              <Trash2 className="size-4 text-error-500" />
            </Button>
          </div>
        ))}

        <div className="flex items-center justify-end gap-2 border-t pt-2">
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="text-lg font-bold" data-testid="sale-total">
            {formatCOP(total)}
          </span>
        </div>
      </div>

      {/* Tipo de venta y método */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Tipo de venta</Label>
          <Select value={saleType} onValueChange={(v) => handleSaleTypeChange(v as 'cash' | 'credit')}>
            <SelectTrigger className="w-full" aria-label="Tipo de venta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SALE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Método de pago</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger className="w-full" aria-label="Método de pago">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Plan de crédito */}
      {saleType === 'credit' && (
        <CreditPlanEditor total={total} config={credit} onConfigChange={setCredit} />
      )}

      {error && (
        <p role="alert" className="text-sm text-error-700">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(submitting && 'opacity-70')}
        >
          {submitting ? 'Registrando…' : 'Registrar venta'}
        </Button>
      </div>
    </div>
  );
}
