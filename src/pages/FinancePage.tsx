/**
 * FinancePage — Módulo financiero.
 *
 * Ensambla el resumen (FinanceOverview), el historial filtrable
 * (FinanceMovements) y el formulario de traslados (TransferForm), y organiza
 * los movimientos en sub-pestañas mediante Tabs de shadcn/ui:
 * pagos de membresía, ventas, inventario, cartera y precios.
 *
 * En esta iteración las sub-pestañas renderizan el historial filtrado por
 * categoría (o un placeholder cuando aún no hay integración cross-module).
 * El resto del wiring se completa en la Fase 2.
 *
 * Requirements: 7.1, 7.2, 7.5, 7.7
 */

import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FinanceOverview } from '@/components/finance/FinanceOverview';
import { FinanceMovements } from '@/components/finance/FinanceMovements';
import { TransferForm } from '@/components/finance/TransferForm';
import { useFinance } from '@/hooks/useFinance';
import { FinanceService } from '@/services/FinanceService';

/** Sub-pestañas exigidas por el Requirement 7.2. */
const FINANCE_TABS = [
  { value: 'membresias', label: 'Pagos de membresía', category: 'Mensualidades' },
  { value: 'ventas', label: 'Ventas', category: 'Ventas' },
  { value: 'inventario', label: 'Inventario', category: 'Inventario' },
  { value: 'cartera', label: 'Cartera', category: 'Cartera' },
  { value: 'precios', label: 'Precios', category: 'Precios' },
] as const;

export function FinancePage() {
  const {
    movements,
    summary,
    loading,
    error,
    filter,
    setFilter,
    transfer,
  } = useFinance();

  // Agrupa los movimientos filtrados por categoría para cada sub-pestaña.
  // La comparación es case-insensitive para tolerar variaciones de categorías.
  const movementsByCategory = useMemo(() => {
    const map: Record<string, typeof movements> = {};
    for (const tab of FINANCE_TABS) {
      const key = tab.category.toLowerCase();
      map[tab.value] = movements.filter((m) => m.category.toLowerCase() === key);
    }
    return map;
  }, [movements]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finanzas</h1>
        <p className="text-muted-foreground">
          Movimientos financieros, traslados y resumen por período.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700"
        >
          {error}
        </div>
      )}

      {/* Resumen de ingresos, egresos y balance */}
      <FinanceOverview summary={summary} loading={loading} />

      {/* Formulario de traslados */}
      <Card>
        <CardHeader>
          <CardTitle>Registrar traslado</CardTitle>
          <CardDescription>
            Mueve dinero entre cajas o entre métodos de pago. Se registran dos
            movimientos balanceados con efecto neto cero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransferForm onSubmit={transfer} submitting={loading} />
        </CardContent>
      </Card>

      {/* Sub-pestañas de movimientos (Req 7.2) */}
      <Tabs defaultValue={FINANCE_TABS[0].value}>
        <TabsList className="flex-wrap">
          {FINANCE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {FINANCE_TABS.map((tab) => {
          const tabMovements = movementsByCategory[tab.value] ?? [];
          const tabSummary =
            tabMovements.length > 0
              ? FinanceService.computeSummary(tabMovements)
              : { totalIncome: 0, totalExpense: 0, balance: 0 };

          return (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              <div className="flex flex-col gap-4">
                {/* Nota: la integración con Pagos, Ventas, Inventario y Cartera
                    (Tracks B/C) se conecta en la Fase 2. Por ahora se muestran
                    los movimientos existentes con esa categoría. */}
                {tabMovements.length === 0 && !loading ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay movimientos en «{tab.label}». Esta sección se
                    conectará con su módulo correspondiente en la Fase 2.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Balance de la sección:{' '}
                    <span className="font-medium text-foreground">
                      {new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        maximumFractionDigits: 0,
                      }).format(tabSummary.balance)}
                    </span>
                  </p>
                )}

                <FinanceMovements
                  movements={tabMovements}
                  filter={filter}
                  onFilterChange={setFilter}
                  loading={loading}
                />
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
