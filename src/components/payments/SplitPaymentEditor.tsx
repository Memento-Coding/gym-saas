/**
 * SplitPaymentEditor — Editor de pagos divididos entre varios métodos.
 *
 * Se muestra cuando el usuario activa el checkbox "Dividir pago". Permite
 * agregar/quitar filas [Método] - [Monto] y valida EN VIVO que la suma de los
 * montos iguale el total a pagar (Req 5.6).
 *
 * Componente controlado: el estado de los splits vive en el formulario padre.
 *
 * Requirements: 5.6
 */

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { PaymentMethod, PaymentSplit } from '@/types/payment';

const METHODS: PaymentMethod[] = ['Efectivo', 'Nequi', 'Banco'];

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface SplitPaymentEditorProps {
  /** Total neto a pagar (amount - discount) que los splits deben igualar. */
  total: number;
  /** ¿Está activo el modo dividir? */
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Filas actuales de splits. */
  splits: PaymentSplit[];
  onSplitsChange: (splits: PaymentSplit[]) => void;
}

export function SplitPaymentEditor({
  total,
  enabled,
  onEnabledChange,
  splits,
  onSplitsChange,
}: SplitPaymentEditorProps) {
  const sum = splits.reduce((acc, s) => acc + (Number.isFinite(s.amount) ? s.amount : 0), 0);
  const difference = total - sum;
  const isBalanced = enabled ? sum === total : true;

  const addRow = () => {
    onSplitsChange([...splits, { method: 'Efectivo', amount: 0 }]);
  };

  const removeRow = (index: number) => {
    onSplitsChange(splits.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, patch: Partial<PaymentSplit>) => {
    onSplitsChange(splits.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleToggle = (checked: boolean) => {
    onEnabledChange(checked);
    // Al activar sin filas, sembramos una fila inicial con el total.
    if (checked && splits.length === 0) {
      onSplitsChange([{ method: 'Efectivo', amount: total }]);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="split-toggle"
          checked={enabled}
          onCheckedChange={(v) => handleToggle(v === true)}
        />
        <Label htmlFor="split-toggle" className="cursor-pointer">
          Dividir pago entre varios métodos
        </Label>
      </div>

      {enabled && (
        <div className="flex flex-col gap-3 rounded-lg ring-1 ring-foreground/10 p-3">
          {splits.map((split, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="grid flex-1 gap-1.5">
                <Label className="text-xs text-muted-foreground">Método</Label>
                <Select
                  value={split.method}
                  onValueChange={(v) => updateRow(index, { method: v as PaymentMethod })}
                >
                  <SelectTrigger className="w-full">
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

              <div className="grid flex-1 gap-1.5">
                <Label className="text-xs text-muted-foreground">Monto</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={Number.isFinite(split.amount) ? split.amount : ''}
                  onChange={(e) =>
                    updateRow(index, { amount: e.target.value === '' ? 0 : Number(e.target.value) })
                  }
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar fila"
                onClick={() => removeRow(index)}
                disabled={splits.length <= 1}
              >
                <Trash2 className="size-4 text-error-500" />
              </Button>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-4" />
              Agregar método
            </Button>

            {/* Validación en vivo de la suma vs total (Req 5.6). */}
            <div className="text-sm">
              <span className="text-muted-foreground">Suma: </span>
              <span
                className={cn('font-medium', isBalanced ? 'text-success-700' : 'text-error-700')}
              >
                {formatCOP(sum)}
              </span>
              <span className="text-muted-foreground"> / {formatCOP(total)}</span>
            </div>
          </div>

          {!isBalanced && (
            <p role="alert" className="text-sm text-error-700">
              {difference > 0
                ? `Faltan ${formatCOP(difference)} por asignar.`
                : `Se excede en ${formatCOP(Math.abs(difference))}.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
