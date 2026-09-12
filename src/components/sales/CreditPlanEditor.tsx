/**
 * CreditPlanEditor — Editor del plan de cuotas para ventas a crédito.
 *
 * Componente controlado por el padre (patrón SplitPaymentEditor). Captura:
 *  - Tipo de plan: cuota única o 3 cuotas (cada 15 días).
 *  - Abono inicial (no negativo, no mayor al total).
 *  - Fecha de la cuota única / arranque del plan.
 *
 * Muestra un preview en vivo de las cuotas usando buildCreditPlan del servicio
 * (fuente única de la lógica de cuotas). El editor no calcula cuotas por su
 * cuenta: solo previsualiza y reporta la configuración al padre.
 *
 * Requirements: 9.4
 */

import { useMemo } from 'react';
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
import { buildCreditPlan, type CreditPlanInput } from '@/services/SaleService';

const PLAN_OPTIONS = [
  { value: 'single', label: 'Cuota única' },
  { value: 'three_installments', label: '3 cuotas (cada 15 días)' },
] as const;

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

export interface CreditPlanEditorProps {
  /** Total de la venta sobre el que se reparte el crédito. */
  total: number;
  config: CreditPlanInput;
  onConfigChange: (config: CreditPlanInput) => void;
}

export function CreditPlanEditor({ total, config, onConfigChange }: CreditPlanEditorProps) {
  const initialPayment = config.initialPayment ?? 0;
  const invalidInitial = initialPayment < 0 || initialPayment > total;

  // Preview de cuotas (solo si el abono es válido). Reusa la lógica del servicio.
  const preview = useMemo(() => {
    if (invalidInitial) return null;
    try {
      return buildCreditPlan(total, initialPayment, config);
    } catch {
      return null;
    }
  }, [total, initialPayment, config, invalidInitial]);

  const update = (patch: Partial<CreditPlanInput>) => {
    onConfigChange({ ...config, ...patch });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg ring-1 ring-foreground/10 p-3">
      <p className="text-sm font-medium">Plan de crédito</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Tipo de plan */}
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Tipo de plan</Label>
          <Select
            value={config.type}
            onValueChange={(v) =>
              update({ type: v as CreditPlanInput['type'] })
            }
          >
            <SelectTrigger className="w-full" aria-label="Tipo de plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Abono inicial */}
        <div className="grid gap-1.5">
          <Label htmlFor="credit-initial" className="text-xs text-muted-foreground">
            Abono inicial
          </Label>
          <Input
            id="credit-initial"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={config.initialPayment != null ? String(config.initialPayment) : ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              update({ initialPayment: raw === '' ? 0 : Number(raw) });
            }}
          />
        </div>
      </div>

      {/* Fecha (única o de arranque) */}
      <div className="grid gap-1.5">
        <Label htmlFor="credit-date" className="text-xs text-muted-foreground">
          {config.type === 'single' ? 'Fecha de la cuota' : 'Fecha de la primera cuota'}
        </Label>
        <Input
          id="credit-date"
          type="date"
          value={config.type === 'single' ? config.singleDueDate ?? '' : config.startDate ?? ''}
          onChange={(e) =>
            config.type === 'single'
              ? update({ singleDueDate: e.target.value })
              : update({ startDate: e.target.value })
          }
        />
      </div>

      {invalidInitial && (
        <p role="alert" className="text-sm text-error-700">
          El abono inicial debe estar entre {formatCOP(0)} y {formatCOP(total)}.
        </p>
      )}

      {/* Preview de cuotas */}
      {preview && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Cuotas ({preview.installments.length})
          </span>
          {preview.installments.map((inst) => (
            <div
              key={inst.number}
              className="flex items-center justify-between"
              data-testid={`credit-installment-${inst.number}`}
            >
              <span className="text-muted-foreground">
                Cuota {inst.number}
                {inst.dueDate ? ` · ${formatDate(inst.dueDate)}` : ''}
              </span>
              <span className={cn('font-medium')}>{formatCOP(inst.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
