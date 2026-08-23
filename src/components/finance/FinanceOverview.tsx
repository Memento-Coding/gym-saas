/**
 * FinanceOverview — Resumen de ingresos, egresos y balance.
 *
 * Usa el componente Card de shadcn/ui y la paleta de colores semánticos del
 * design system de GymOps (verde/success para ingresos, rojo/error para
 * egresos, índigo/primary para el balance).
 *
 * Requirements: 7.7
 */

import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FinanceSummary } from '@/services/FinanceService';

interface FinanceOverviewProps {
  summary: FinanceSummary;
  loading?: boolean;
}

/** Formatea un monto como moneda colombiana (COP) sin decimales. */
function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FinanceOverview({ summary, loading = false }: FinanceOverviewProps) {
  const balancePositive = summary.balance >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Ingresos — verde (success) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm text-muted-foreground">Ingresos</CardTitle>
          <ArrowUpCircle className="size-5 text-success-500" aria-hidden />
        </CardHeader>
        <CardContent>
          <p
            className="text-2xl font-bold tracking-tight text-success-700"
            aria-live="polite"
          >
            {loading ? '—' : formatCOP(summary.totalIncome)}
          </p>
        </CardContent>
      </Card>

      {/* Egresos — rojo (error) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm text-muted-foreground">Egresos</CardTitle>
          <ArrowDownCircle className="size-5 text-error-500" aria-hidden />
        </CardHeader>
        <CardContent>
          <p
            className="text-2xl font-bold tracking-tight text-error-700"
            aria-live="polite"
          >
            {loading ? '—' : formatCOP(summary.totalExpense)}
          </p>
        </CardContent>
      </Card>

      {/* Balance — índigo (primary) o rojo si es negativo */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm text-muted-foreground">Balance</CardTitle>
          <Wallet
            className={cn('size-5', balancePositive ? 'text-primary-600' : 'text-error-500')}
            aria-hidden
          />
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              'text-2xl font-bold tracking-tight',
              balancePositive ? 'text-primary-700' : 'text-error-700',
            )}
            aria-live="polite"
          >
            {loading ? '—' : formatCOP(summary.balance)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
