/**
 * useCourtesies — Custom hook para gestión del módulo de cortesías.
 *
 * Envuelve el CourtesyService y gestiona estado reactivo para:
 * - Lista de bonos agrupados por estudiante
 * - Acciones: agregar bono, eliminar bono, recargar datos
 *
 * Requirements: 13.1, 13.2, 13.3
 */

import { useState, useEffect, useCallback } from 'react';
import { getStorageService } from '@/services/storage';
import { CourtesyService, type CourtesyBonusInput, type StudentBonusGroup } from '@/services/CourtesyService';

interface UseCourtesiesReturn {
  bonusGroups: StudentBonusGroup[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  addBonus: (studentId: string, input: CourtesyBonusInput) => Promise<void>;
  removeBonus: (studentId: string, bonusId: string) => Promise<void>;
}

export function useCourtesies(): UseCourtesiesReturn {
  const [bonusGroups, setBonusGroups] = useState<StudentBonusGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<CourtesyService | null>(null);

  // Initialize the service
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        const courtesyService = new CourtesyService(storage);
        if (!cancelled) {
          setService(courtesyService);
        }
      } catch {
        if (!cancelled) {
          setError('Error al inicializar el servicio de cortesías.');
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Load data whenever the service is ready
  const refreshData = useCallback(async () => {
    if (!service) return;

    setLoading(true);
    setError(null);

    try {
      const groups = await service.getAllBonuses();
      setBonusGroups(groups);
    } catch {
      setError('Error al cargar datos de cortesías.');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (service) {
      refreshData();
    }
  }, [service, refreshData]);

  const addBonus = useCallback(
    async (studentId: string, input: CourtesyBonusInput) => {
      if (!service) return;
      setError(null);

      try {
        await service.addBonus(studentId, input);
        await refreshData();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al registrar el bono.';
        setError(message);
        throw err;
      }
    },
    [service, refreshData],
  );

  const removeBonus = useCallback(
    async (studentId: string, bonusId: string) => {
      if (!service) return;
      setError(null);

      try {
        await service.removeBonus(studentId, bonusId);
        await refreshData();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al eliminar el bono.';
        setError(message);
        throw err;
      }
    },
    [service, refreshData],
  );

  return {
    bonusGroups,
    loading,
    error,
    refreshData,
    addBonus,
    removeBonus,
  };
}
