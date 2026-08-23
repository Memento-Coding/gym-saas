/**
 * MonthlyChart — Gráfico comparativo de estudiantes activos por mes.
 *
 * BarChart de recharts que compara el año actual contra el anterior
 * (Requirement 10.3). Recibe los datos por props; si no se proveen, usa datos
 * dummy (6 meses) para desarrollo. En la Fase 2 se conectarán los datos reales.
 *
 * Requirements: 10.3
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface MonthlyDatum {
  /** Etiqueta del mes, ej. "Ene", "Feb". */
  month: string;
  /** Estudiantes activos ese mes en el año actual. */
  currentYear: number;
  /** Estudiantes activos ese mes en el año anterior. */
  previousYear: number;
}

interface MonthlyChartProps {
  data?: MonthlyDatum[];
  currentYearLabel?: string;
  previousYearLabel?: string;
}

/** Datos dummy (6 meses) mientras se conecta la fuente real en la Fase 2. */
const DUMMY_DATA: MonthlyDatum[] = [
  { month: 'Mar', currentYear: 38, previousYear: 30 },
  { month: 'Abr', currentYear: 42, previousYear: 33 },
  { month: 'May', currentYear: 40, previousYear: 36 },
  { month: 'Jun', currentYear: 45, previousYear: 38 },
  { month: 'Jul', currentYear: 48, previousYear: 41 },
  { month: 'Ago', currentYear: 52, previousYear: 44 },
];

export function MonthlyChart({
  data = DUMMY_DATA,
  currentYearLabel = 'Año actual',
  previousYearLabel = 'Año anterior',
}: MonthlyChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estudiantes activos por mes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-secondary-200)" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="var(--color-secondary-500)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-secondary-500)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-secondary-100)' }}
                contentStyle={{
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-secondary-200)',
                  fontSize: 'var(--text-sm)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 'var(--text-xs)' }} />
              <Bar
                dataKey="previousYear"
                name={previousYearLabel}
                fill="var(--color-secondary-300)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="currentYear"
                name={currentYearLabel}
                fill="var(--color-primary-600)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
