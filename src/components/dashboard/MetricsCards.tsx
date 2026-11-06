/**
 * MetricsCards — Tarjetas de métricas del dashboard.
 *
 * Muestra las 6 métricas exigidas por el Requirement 10.1:
 * activos al día, por vencer, vencidos, congelados, inactivos y total recaudado.
 *
 * Usa el componente Card de shadcn/ui, la tipografía --text-3xl para los números
 * y los colores de status del design system (var(--status-active-text), etc.).
 *
 * Requirements: 10.1
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardMetrics } from '@/services/DashboardService';

interface MetricsCardsProps {
  metrics: DashboardMetrics;
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

interface MetricDef {
  key: string;
  label: string;
  value: (m: DashboardMetrics) => string | number;
  /** Color del número usando un token CSS de status/semántico. */
  color: string;
}

const METRICS: MetricDef[] = [
  {
    key: 'activeUpToDate',
    label: 'Activos al día',
    value: (m) => m.activeUpToDate,
    color: 'var(--status-active-text)',
  },
  {
    key: 'aboutToExpire',
    label: 'Por vencer',
    value: (m) => m.aboutToExpire,
    color: 'var(--payment-expiring-text)',
  },
  {
    key: 'expired',
    label: 'Vencidos',
    value: (m) => m.expired,
    color: 'var(--payment-overdue-text)',
  },
  {
    key: 'frozen',
    label: 'Congelados',
    value: (m) => m.frozen,
    color: 'var(--status-frozen-text)',
  },
  {
    key: 'inactive',
    label: 'Inactivos',
    value: (m) => m.inactive,
    color: 'var(--status-inactive-text)',
  },
  {
    key: 'totalCollected',
    label: 'Total recaudado',
    value: (m) => formatCOP(m.totalCollected),
    color: 'var(--color-primary-700)',
  },
];

export function MetricsCards({ metrics, loading = false }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {METRICS.map((metric) => (
        <Card key={metric.key} className="gap-2 py-4">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {metric.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="metric-value font-bold"
              style={{
                fontSize: 'clamp(1.35rem, 2.5vw, 1.75rem)',
                color: metric.color,
              }}
              aria-live="polite"
            >
              {loading ? (
                <span className="skeleton inline-block w-16 h-7 rounded-lg" />
              ) : (
                metric.value(metrics)
              )}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
