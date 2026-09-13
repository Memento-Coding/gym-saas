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
import { isApiMode } from '@/config/env';
import {
  listApiCourtesies,
  createApiCourtesy,
  deleteApiCourtesy,
} from '@/services/api';
import { studentService } from '@/services/StudentService';
import type { CourtesyBonus } from '@/types/courtesy';

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
      if (isApiMode()) {
        // Las cortesías son una entidad propia en la API (/courtesies). Se
        // agrupan por estudiante para la UI.
        const list = await listApiCourtesies();
        const groups = new Map<string, StudentBonusGroup>();
        for (const c of list) {
          const studentId = (c.studentId as string) ?? '';
          const group = groups.get(studentId) ?? {
            studentId,
            studentName: (c.studentName as string) ?? '',
            bonuses: [] as CourtesyBonus[],
          };
          group.bonuses.push({
            id: c.id,
            startDate: (c.startDate as string) ?? '',
            endDate: (c.endDate as string) ?? '',
            reason: (c.reason as string) ?? '',
            weeks: (c.weeks as number) ?? 0,
          });
          groups.set(studentId, group);
        }
        setBonusGroups([...groups.values()]);
      } else {
        const groups = await service.getAllBonuses();
        setBonusGroups(groups);
      }
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
        if (isApiMode()) {
          const student = await studentService.getById(studentId);
          const studentName = student
            ? `${student.firstName} ${student.lastName}`.trim()
            : '';
          await createApiCourtesy(studentId, studentName, {
            startDate: input.startDate,
            weeks: input.weeks,
            reason: input.reason,
          });
        } else {
          await service.addBonus(studentId, input);
        }
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
        if (isApiMode()) {
          await deleteApiCourtesy(bonusId);
        } else {
          await service.removeBonus(studentId, bonusId);
        }
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
