/**
 * useMemberships — Custom hook para el módulo de membresías y planes.
 *
 * Envuelve el MembershipService y gestiona estado reactivo para:
 * - Lista de planes grupales y personalizados.
 * - Edición de planes (nombre, precio).
 * - Consulta de planes por ID.
 * - Estado de carga y errores.
 *
 * Requirements: 4.1, 4.2, 4.3
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStorageService } from '@/services/storage';
import { MembershipService, type UpdatePlanInput } from '@/services/MembershipService';
import type { MembershipPlan, CostsConfig } from '@/types/membership';

export interface UseMembershipsReturn {
  /** Todos los planes (grupales + personalizados) */
  allPlans: MembershipPlan[];
  /** Planes grupales (mensualidad) */
  groupPlans: MembershipPlan[];
  /** Planes de entrenamiento personalizado */
  personalizedPlans: MembershipPlan[];
  /** Configuración completa de costos */
  costsConfig: CostsConfig | null;
  /** Estado de carga */
  loading: boolean;
  /** Último error */
  error: string | null;
  /** Recargar los planes desde storage */
  reload: () => Promise<void>;
  /** Actualizar nombre/precio de un plan */
  updatePlan: (planId: string, changes: UpdatePlanInput) => Promise<MembershipPlan | null>;
  /** Buscar plan por ID */
  getPlanById: (planId: string) => Promise<{ plan: MembershipPlan; category: 'mensualidad' | 'personalizada' } | null>;
  /** Restaurar planes a los valores por defecto */
  resetToDefaults: () => Promise<void>;
}

export function useMemberships(): UseMembershipsReturn {
  const [costsConfig, setCostsConfig] = useState<CostsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<MembershipService | null>(null);

  // Inicializar servicio
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        const membershipService = new MembershipService(storage);
        if (!cancelled) {
          setService(membershipService);
        }
      } catch {
        if (!cancelled) {
          setError('Error al inicializar el servicio de membresías.');
          setLoading(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Cargar planes
  const reload = useCallback(async () => {
    if (!service) return;

    setLoading(true);
    setError(null);

    try {
      const config = await service.getCostsConfig();
      setCostsConfig(config);
    } catch {
      setError('Error al cargar los planes de membresía.');
    } finally {
      setLoading(false);
    }
  }, [service]);

  // Cargar al inicializar el servicio
  useEffect(() => {
    if (service) {
      reload();
    }
  }, [service, reload]);

  // Derivar listas de planes desde la config
  const groupPlans = useMemo<MembershipPlan[]>(
    () => costsConfig?.memberships ?? [],
    [costsConfig],
  );

  const personalizedPlans = useMemo<MembershipPlan[]>(
    () => costsConfig?.personalized ?? [],
    [costsConfig],
  );

  const allPlans = useMemo<MembershipPlan[]>(
    () => [...groupPlans, ...personalizedPlans],
    [groupPlans, personalizedPlans],
  );

  // Actualizar un plan
  const updatePlan = useCallback(
    async (planId: string, changes: UpdatePlanInput): Promise<MembershipPlan | null> => {
      if (!service) return null;
      setError(null);

      try {
        const updated = await service.updatePlan(planId, changes);
        if (updated) {
          await reload();
        }
        return updated;
      } catch {
        setError('Error al actualizar el plan.');
        return null;
      }
    },
    [service, reload],
  );

  // Buscar plan por ID
  const getPlanById = useCallback(
    async (planId: string) => {
      if (!service) return null;
      return service.getPlanById(planId);
    },
    [service],
  );

  // Restaurar planes por defecto
  const resetToDefaults = useCallback(async () => {
    if (!service) return;
    setError(null);

    try {
      await service.resetToDefaults();
      await reload();
    } catch {
      setError('Error al restaurar los planes por defecto.');
    }
  }, [service, reload]);

  return {
    allPlans,
    groupPlans,
    personalizedPlans,
    costsConfig,
    loading,
    error,
    reload,
    updatePlan,
    getPlanById,
    resetToDefaults,
  };
}
