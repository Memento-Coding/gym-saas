/**
 * MonthlyChart — Alumnos que pagaron por mes, año actual contra el anterior
 * (Requirement 10.3). Los datos llegan por props (payingStudentsByMonth).
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
  /** Alumnos distintos que pagaron ese mes en el año actual. */
  currentYear: number;
  /** Alumnos distintos que pagaron ese mes en el año anterior. */
  previousYear: number;
}

interface MonthlyChartProps {
  data: MonthlyDatum[];
  currentYearLabel?: string;
  previousYearLabel?: string;
}

export function MonthlyChart({
  data,
  currentYearLabel = 'Año actual',
  previousYearLabel = 'Año anterior',
}: MonthlyChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alumnos que pagaron por mes</CardTitle>
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
