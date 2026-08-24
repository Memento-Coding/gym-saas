/**
 * DashboardPage — Vista principal con métricas, alertas, cumpleaños y gráfico.
 *
 * Integra datos reales: consume el hook useStudents (Track A) y useFinance
 * (Track D), y los alimenta a DashboardService (calculateMetrics, generateAlerts,
 * isBirthdayToday) para producir las métricas, alertas y notificaciones que
 * consumen los componentes visuales del Dashboard.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useStudents } from '@/hooks/useStudents';
import { useFinance } from '@/hooks/useFinance';
import {
  calculateMetrics,
  generateAlerts,
  isBirthdayToday,
  type DashboardAlert,
} from '@/services/DashboardService';

import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { AlertsList } from '@/components/dashboard/AlertsList';
import {
  BirthdayNotification,
  type BirthdayStudent,
} from '@/components/dashboard/BirthdayNotification';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';

export function DashboardPage() {
  const navigate = useNavigate();

  // Datos reales de los tracks A y D.
  const { students, isLoading: studentsLoading } = useStudents();
  const { movements, loading: financeLoading } = useFinance();

  const loading = studentsLoading || financeLoading;

  // Métricas mutuamente excluyentes + total recaudado (Req 10.1).
  const metrics = useMemo(
    () => calculateMetrics(students, movements),
    [students, movements],
  );

  // Alertas ordenadas por urgencia (Req 10.2).
  // Las cuotas de cartera (installments) provienen del módulo de ventas/crédito,
  // que aún no está integrado; se pasan vacías por ahora.
  const alerts = useMemo(
    () => generateAlerts(students, { installments: [] }),
    [students],
  );

  // Cumpleaños del día entre estudiantes activos (Req 10.4).
  const birthdays = useMemo<BirthdayStudent[]>(
    () =>
      students
        .filter((s) => s.status === 'active' && isBirthdayToday(s.dateOfBirth))
        .map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim() })),
    [students],
  );

  /**
   * Navegación desde una alerta al destino correspondiente (Req 10.5).
   * Las membresías y el consentimiento navegan al perfil del estudiante;
   * las cuotas de cartera navegan al módulo de finanzas.
   */
  const handleAlertClick = (alert: DashboardAlert) => {
    switch (alert.type) {
      case 'membership_expired':
      case 'membership_expiring':
      case 'no_consent':
        navigate(`/estudiantes/${alert.studentId}`);
        break;
      case 'installment_expiring':
        navigate('/finanzas');
        break;
    }
  };

  const handleSendGreeting = (student: BirthdayStudent) => {
    // La integración con el módulo de comunicación se conecta en la Fase 2.
    navigate('/comunicacion');
    void student;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen del estado de la academia y alertas prioritarias.
        </p>
      </div>

      {/* Cumpleaños del día */}
      <BirthdayNotification students={birthdays} onSendGreeting={handleSendGreeting} />

      {/* Métricas: 1 col mobile, 2 col tablet, 4 col desktop */}
      <MetricsCards metrics={metrics} loading={loading} />

      {/* Alertas + gráfico */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AlertsList alerts={alerts} loading={loading} onAlertClick={handleAlertClick} />
        <MonthlyChart />
      </div>
    </div>
  );
}
