/**
 * SplitPaymentEditor — Editor visual para dividir el monto de un pago
 * entre múltiples métodos de pago.
 *
 * Funcionalidades:
 * - Agregar/eliminar líneas de split.
 * - Seleccionar método de pago por línea.
 * - Validación en tiempo real: la suma de los montos debe igualar el total.
 * - Indicador visual de diferencia (faltante o excedente).
 *
 * Requirements: 5.5
 */

import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaymentMethod, PaymentSplit } from '@/types/payment';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface SplitPaymentEditorProps {
  totalAmount: number;
  splits: PaymentSplit[];
  onChange: (splits: PaymentSplit[]) => void;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Nequi', label: 'Nequi' },
  { value: 'Banco', label: 'Banco' },
];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SplitPaymentEditor({
  totalAmount,
  splits,
  onChange,
}: SplitPaymentEditorProps) {
  // Suma actual de los splits
  const currentSum = useMemo(
    () => splits.reduce((sum, s) => sum + s.amount, 0),
    [splits],
  );

  const difference = totalAmount - currentSum;
  const isValid = Math.abs(difference) < 1; // tolerancia de $1

  // Agregar una nueva línea de split
  const addSplit = useCallback(() => {
    const remaining = Math.max(0, totalAmount - currentSum);
    const newSplit: PaymentSplit = {
      method: 'Efectivo',
      amount: remaining,
    };
    onChange([...splits, newSplit]);
  }, [splits, onChange, totalAmount, currentSum]);

  // Eliminar una línea de split
  const removeSplit = useCallback(
    (index: number) => {
      const next = splits.filter((_, i) => i !== index);
      onChange(next);
    },
    [splits, onChange],
  );

  // Actualizar el método de una línea
  const updateMethod = useCallback(
    (index: number, method: PaymentMethod) => {
      const next = splits.map((s, i) => (i === index ? { ...s, method } : s));
      onChange(next);
    },
    [splits, onChange],
  );

  // Actualizar el monto de una línea
  const updateAmount = useCallback(
    (index: number, amount: number) => {
      const next = splits.map((s, i) => (i === index ? { ...s, amount } : s));
      onChange(next);
    },
    [splits, onChange],
  );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Pago dividido</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSplit}
        >
          + Agregar método
        </Button>
      </div>

      {/* Lista de splits */}
      {splits.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Agrega al menos dos métodos de pago para dividir el monto.
        </p>
      )}

      <div className="space-y-2">
        {splits.map((split, index) => (
          <div
            key={index}
            className="flex items-center gap-2"
          >
            {/* Método */}
            <Select
              value={split.method}
              onValueChange={(val) => updateMethod(index, val as PaymentMethod)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Monto */}
            <Input
              type="number"
              min="0"
              step="1000"
              value={split.amount || ''}
              onChange={(e) => updateAmount(index, Number(e.target.value) || 0)}
              placeholder="$0"
              className="flex-1"
            />

            {/* Eliminar */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeSplit(index)}
              className="text-destructive hover:text-destructive/80 shrink-0"
              aria-label={`Eliminar split ${index + 1}`}
            >
              ✕
            </Button>
          </div>
        ))}
      </div>

      {/* Indicador de validación */}
      {splits.length > 0 && (
        <div
          className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
            isValid
              ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
          }`}
        >
          <span>
            Suma: ${currentSum.toLocaleString('es-CO')} / ${totalAmount.toLocaleString('es-CO')}
          </span>
          {!isValid && (
            <span className="font-medium">
              {difference > 0
                ? `Faltan $${difference.toLocaleString('es-CO')}`
                : `Excedente $${Math.abs(difference).toLocaleString('es-CO')}`}
            </span>
          )}
          {isValid && <span className="font-medium">Correcto</span>}
        </div>
      )}
    </div>
  );
}
