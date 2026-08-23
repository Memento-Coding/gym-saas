/**
 * StudentFilters — Controles de filtrado de la lista de estudiantes (Req 3.7).
 *
 * Dos menús desplegables:
 *  - Estado de pago: Todos | Al día | Por vencer | Vencido.
 *  - Edad:           Todos | Menor | Adulto.
 *
 * Componente controlado: no mantiene estado propio, notifica los cambios al
 * padre para que este aplique studentService.filter.
 */

import type { AgeGroup, PaymentStatus } from '@/services/StudentService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Valor centinela para "sin filtro" (Select no admite value=""). */
export const ALL = 'all' as const;

export type PaymentFilterValue = PaymentStatus | typeof ALL;
export type AgeFilterValue = AgeGroup | typeof ALL;

export interface StudentFiltersProps {
  paymentStatus: PaymentFilterValue;
  ageGroup: AgeFilterValue;
  onPaymentStatusChange: (value: PaymentFilterValue) => void;
  onAgeGroupChange: (value: AgeFilterValue) => void;
}

export function StudentFilters({
  paymentStatus,
  ageGroup,
  onPaymentStatusChange,
  onAgeGroupChange,
}: StudentFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Estado de pago */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          Estado de pago
        </span>
        <Select
          value={paymentStatus}
          onValueChange={(v) => onPaymentStatusChange(v as PaymentFilterValue)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="al_dia">Al día</SelectItem>
            <SelectItem value="por_vencer">Por vencer</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Edad */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Edad</span>
        <Select
          value={ageGroup}
          onValueChange={(v) => onAgeGroupChange(v as AgeFilterValue)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="menor">Menor</SelectItem>
            <SelectItem value="adulto">Adulto</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
