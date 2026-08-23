/**
 * AlertsList — Lista de alertas del dashboard ordenadas por urgencia.
 *
 * Cada alerta es clickeable (hover state + role button) para permitir navegar
 * al perfil del estudiante o al módulo correspondiente (Requirement 10.5).
 * Usa colores semánticos: error para vencidas, warning para por vencer,
 * info para cuotas de cartera y secondary para consentimiento pendiente.
 *
 * Requirements: 10.2, 10.5
 */

import { AlertTriangle, CalendarClock, CreditCard, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AlertType, DashboardAlert } from '@/services/DashboardService';

interface AlertsListProps {
  alerts: DashboardAlert[];
  loading?: boolean;
  /** Callback de navegación al hacer click en una alerta (Req 10.5). */
  onAlertClick?: (alert: DashboardAlert) => void;
}

/** Estilos semánticos por tipo de alerta. */
const ALERT_STYLES: Record<
  AlertType,
  { bg: string; text: string; icon: typeof AlertTriangle; label: string }
> = {
  membership_expired: {
    bg: 'bg-error-50 hover:bg-error-50/70',
    text: 'text-error-700',
    icon: AlertTriangle,
    label: 'Membresía vencida',
  },
  membership_expiring: {
    bg: 'bg-warning-50 hover:bg-warning-50/70',
    text: 'text-warning-700',
    icon: CalendarClock,
    label: 'Por vencer',
  },
  installment_expiring: {
    bg: 'bg-info-50 hover:bg-info-50/70',
    text: 'text-info-700',
    icon: CreditCard,
    label: 'Cuota por vencer',
  },
  no_consent: {
    bg: 'bg-secondary-100 hover:bg-secondary-200',
    text: 'text-secondary-700',
    icon: FileWarning,
    label: 'Sin consentimiento',
  },
};

export function AlertsList({ alerts, loading = false, onAlertClick }: AlertsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alertas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando alertas…</p>
        ) : alerts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay alertas pendientes. Todo en orden.
          </p>
        ) : (
          alerts.map((alert, index) => {
            const style = ALERT_STYLES[alert.type];
            const Icon = style.icon;
            const clickable = Boolean(onAlertClick);
            return (
              <div
                key={`${alert.type}-${alert.studentId}-${index}`}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onAlertClick?.(alert) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onAlertClick?.(alert);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                  style.bg,
                  clickable && 'cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                )}
              >
                <Icon className={cn('size-5 shrink-0', style.text)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-medium', style.text)}>
                    {alert.studentName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{alert.message}</p>
                </div>
                <span className={cn('shrink-0 text-xs font-medium', style.text)}>
                  {style.label}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
