/**
 * useMemberships — Custom hook para el módulo de membresías.
 *
 * Envuelve el MembershipService y expone el estado reactivo de los planes
 * (grupales y personalizados), estados de carga y funciones de consulta/edición.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { useState, useEffect, useCallback } from 'react';
import { getStorageService } from '@/services/storage';
import {
  MembershipService,
  type UpdatePlanInput,
} from '@/services/MembershipService';
import type { MembershipPlan } from '@/types/membership';

interface UseMembershipsReturn {
  /** Planes grupales (mensualidad). */
  groupPlans: MembershipPlan[];
  /** Planes de entrenamiento personalizado. */
  personalizedPlans: MembershipPlan[];
  /** Todos los planes combinados. */
  allPlans: MembershipPlan[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  getPlanById: (
    planId: string,
  ) => { plan: MembershipPlan; category: 'mensualidad' | 'personalizada' } | null;
  updatePlan: (planId: string, changes: UpdatePlanInput) => Promise<void>;
}

export function useMemberships(): UseMembershipsReturn {
  const [groupPlans, setGroupPlans] = useState<MembershipPlan[]>([]);
  const [personalizedPlans, setPersonalizedPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<MembershipService | null>(null);

  // Inicializa el servicio una sola vez.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        const membershipService = new MembershipService(storage);
        if (!cancelled) setService(membershipService);
      } catch {
        if (!cancelled) {
          setError('Error al inicializar el servicio de membresías.');
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!service) return;
    setLoading(true);
    setError(null);
    try {
      const config = await service.getCostsConfig();
      setGroupPlans(config.memberships);
      setPersonalizedPlans(config.personalized);
    } catch {
      setError('Error al cargar los planes de membresía.');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (service) refreshData();
  }, [service, refreshData]);

  // Búsqueda síncrona sobre el estado ya cargado (no toca storage).
  const getPlanById = useCallback(
    (planId: string) => {
      const group = groupPlans.find((p) => p.id === planId);
      if (group) return { plan: group, category: 'mensualidad' as const };
      const personalized = personalizedPlans.find((p) => p.id === planId);
      if (personalized) return { plan: personalized, category: 'personalizada' as const };
      return null;
    },
    [groupPlans, personalizedPlans],
  );

  const updatePlan = useCallback(
    async (planId: string, changes: UpdatePlanInput) => {
      if (!service) return;
      setError(null);
      try {
        await service.updatePlan(planId, changes);
        await refreshData();
      } catch {
        setError('Error al actualizar el plan.');
        throw new Error('Error al actualizar el plan.');
      }
    },
    [service, refreshData],
  );

  return {
    groupPlans,
    personalizedPlans,
    allPlans: [...groupPlans, ...personalizedPlans],
    loading,
    error,
    refreshData,
    getPlanById,
    updatePlan,
  };
}
