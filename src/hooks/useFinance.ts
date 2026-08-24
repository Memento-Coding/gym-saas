/**
 * useFinance — Custom hook para el módulo de finanzas.
 *
 * Envuelve el FinanceService y gestiona estado reactivo para:
 * - Lista de movimientos financieros (con filtro opcional por mes/caja)
 * - Resumen (ingresos, egresos, balance)
 * - Acciones: crear, actualizar, eliminar movimientos y registrar traslados
 * - Estados de carga (loading) y refresco
 *
 * Requirements: 7.1, 7.2, 7.5, 7.7
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStorageService } from '@/services/storage';
import {
  FinanceService,
  type CreateMovementInput,
  type TransferInput,
  type FinanceFilter,
  type FinanceSummary,
} from '@/services/FinanceService';
import type { FinanceMovement } from '@/types/finance';

interface UseFinanceReturn {
  movements: FinanceMovement[];
  summary: FinanceSummary;
  loading: boolean;
  error: string | null;
  filter: FinanceFilter;
  setFilter: (filter: FinanceFilter) => void;
  refreshData: () => Promise<void>;
  createMovement: (input: CreateMovementInput) => Promise<void>;
  updateMovement: (
    id: string,
    changes: Partial<Omit<FinanceMovement, 'id'>>,
  ) => Promise<void>;
  deleteMovement: (id: string) => Promise<void>;
  transfer: (input: TransferInput) => Promise<void>;
}

const EMPTY_SUMMARY: FinanceSummary = { totalIncome: 0, totalExpense: 0, balance: 0 };

export function useFinance(initialFilter: FinanceFilter = {}): UseFinanceReturn {
  const [allMovements, setAllMovements] = useState<FinanceMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FinanceFilter>(initialFilter);
  const [service, setService] = useState<FinanceService | null>(null);

  // Inicializa el servicio una sola vez
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        const financeService = new FinanceService(storage);
        if (!cancelled) {
          setService(financeService);
        }
      } catch {
        if (!cancelled) {
          setError('Error al inicializar el servicio de finanzas.');
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Carga todos los movimientos desde el servicio
  const refreshData = useCallback(async () => {
    if (!service) return;

    setLoading(true);
    setError(null);

    try {
      const data = await service.getAll();
      setAllMovements(data);
    } catch {
      setError('Error al cargar los movimientos financieros.');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (service) {
      refreshData();
    }
  }, [service, refreshData]);

  // Aplica el filtro en memoria (mes/caja) sobre la lista completa
  const movements = useMemo(
    () => FinanceService.applyFilter(allMovements, filter),
    [allMovements, filter],
  );

  // El resumen se calcula sobre los movimientos filtrados
  const summary = useMemo<FinanceSummary>(
    () => (movements.length > 0 ? FinanceService.computeSummary(movements) : EMPTY_SUMMARY),
    [movements],
  );

  const createMovement = useCallback(
    async (input: CreateMovementInput) => {
      if (!service) return;
      setError(null);
      try {
        await service.create(input);
        await refreshData();
      } catch {
        setError('Error al crear el movimiento.');
        throw new Error('Error al crear el movimiento.');
      }
    },
    [service, refreshData],
  );

  const updateMovement = useCallback(
    async (id: string, changes: Partial<Omit<FinanceMovement, 'id'>>) => {
      if (!service) return;
      setError(null);
      try {
        await service.update(id, changes);
        await refreshData();
      } catch {
        setError('Error al actualizar el movimiento.');
        throw new Error('Error al actualizar el movimiento.');
      }
    },
    [service, refreshData],
  );

  const deleteMovement = useCallback(
    async (id: string) => {
      if (!service) return;
      setError(null);
      try {
        await service.delete(id);
        await refreshData();
      } catch {
        setError('Error al eliminar el movimiento.');
        throw new Error('Error al eliminar el movimiento.');
      }
    },
    [service, refreshData],
  );

  const transfer = useCallback(
    async (input: TransferInput) => {
      if (!service) return;
      setError(null);
      try {
        await service.transfer(input);
        await refreshData();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al registrar el traslado.';
        setError(message);
        throw err;
      }
    },
    [service, refreshData],
  );

  return {
    movements,
    summary,
    loading,
    error,
    filter,
    setFilter,
    refreshData,
    createMovement,
    updateMovement,
    deleteMovement,
    transfer,
  };
}
