/**
 * MembershipService — Gestión de planes de membresía de la academia.
 *
 * Responsabilidades:
 * - Gestionar dos categorías de planes: grupales (mensualidad) y entrenamiento personalizado.
 * - Proveer planes por defecto con precios iniciales.
 * - Permitir edición de nombres y precios de los planes existentes.
 * - Manejar la propiedad `single: true` (Clase única) que NO extiende subscriptionEndDate.
 * - Persistir la configuración de planes en StorageService.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import type { StorageService } from '@/services/storage/StorageService';
import type { MembershipPlan, CostsConfig } from '@/types/membership';

/** Storage key para la configuración de planes */
const COSTS_KEY = 'gymops_costs_config';

/**
 * Planes grupales por defecto (mensualidad).
 * Incluyen Premium, Estándar, Básico, Funcional y Clase única.
 */
const DEFAULT_GROUP_PLANS: MembershipPlan[] = [
  { id: 'grp_premium', name: 'Premium', price: 110_000 },
  { id: 'grp_estandar', name: 'Estándar', price: 95_000 },
  { id: 'grp_basico', name: 'Básico', price: 80_000 },
  { id: 'grp_funcional', name: 'Entrenamiento funcional', price: 80_000 },
  { id: 'grp_clase_unica', name: 'Clase única', price: 20_000, single: true },
];

/**
 * Planes de entrenamiento personalizado por defecto.
 * Varían según frecuencia semanal de clases.
 */
const DEFAULT_PERSONALIZED_PLANS: MembershipPlan[] = [
  { id: 'per_1clase', name: '1 clase', price: 60_000, single: true },
  { id: 'per_1sem', name: '1/sem', price: 220_000, classesPerMonth: 4 },
  { id: 'per_2sem', name: '2/sem', price: 430_000, classesPerMonth: 8 },
  { id: 'per_3sem', name: '3/sem', price: 575_000, classesPerMonth: 12 },
  { id: 'per_5sem', name: '5/sem', price: 790_000, classesPerMonth: 20 },
];

/** Input para actualizar un plan existente */
export interface UpdatePlanInput {
  name?: string;
  price?: number;
}

export class MembershipService {
  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  // ---------------------------------------------------------------------------
  // Lectura
  // ---------------------------------------------------------------------------

  /**
   * Retorna la configuración completa de planes.
   * Si no existe en storage, inicializa con los planes por defecto.
   */
  async getCostsConfig(): Promise<CostsConfig> {
    const config = await this.storageService.get<CostsConfig>(COSTS_KEY);
    if (config) return config;

    // Primera ejecución: persistir los planes por defecto
    const defaults: CostsConfig = {
      memberships: [...DEFAULT_GROUP_PLANS],
      personalized: [...DEFAULT_PERSONALIZED_PLANS],
    };
    await this.storageService.set<CostsConfig>(COSTS_KEY, defaults);
    return defaults;
  }

  /**
   * Retorna los planes grupales (mensualidad).
   */
  async getGroupPlans(): Promise<MembershipPlan[]> {
    const config = await this.getCostsConfig();
    return config.memberships;
  }

  /**
   * Retorna los planes de entrenamiento personalizado.
   */
  async getPersonalizedPlans(): Promise<MembershipPlan[]> {
    const config = await this.getCostsConfig();
    return config.personalized;
  }

  /**
   * Retorna todos los planes combinados (grupales + personalizados).
   */
  async getAllPlans(): Promise<MembershipPlan[]> {
    const config = await this.getCostsConfig();
    return [...config.memberships, ...config.personalized];
  }

  /**
   * Busca un plan por su ID en cualquiera de las dos categorías.
   * Retorna el plan y su categoría, o null si no existe.
   */
  async getPlanById(
    planId: string,
  ): Promise<{ plan: MembershipPlan; category: 'mensualidad' | 'personalizada' } | null> {
    const config = await this.getCostsConfig();

    const groupPlan = config.memberships.find((p) => p.id === planId);
    if (groupPlan) return { plan: groupPlan, category: 'mensualidad' };

    const personalizedPlan = config.personalized.find((p) => p.id === planId);
    if (personalizedPlan) return { plan: personalizedPlan, category: 'personalizada' };

    return null;
  }

  // ---------------------------------------------------------------------------
  // Edición de planes
  // ---------------------------------------------------------------------------

  /**
   * Actualiza el nombre y/o precio de un plan existente.
   *
   * Requirement 4.3: Edición de planes existentes (nombre y precio).
   *
   * @param planId ID del plan a actualizar.
   * @param changes Campos a modificar (name, price).
   * @returns El plan actualizado, o null si no se encontró.
   */
  async updatePlan(planId: string, changes: UpdatePlanInput): Promise<MembershipPlan | null> {
    const config = await this.getCostsConfig();

    // Buscar en planes grupales
    const groupIdx = config.memberships.findIndex((p) => p.id === planId);
    if (groupIdx !== -1) {
      const plan = config.memberships[groupIdx];
      const updated: MembershipPlan = {
        ...plan,
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.price !== undefined && { price: changes.price }),
      };
      config.memberships[groupIdx] = updated;
      await this.storageService.set<CostsConfig>(COSTS_KEY, config);
      return updated;
    }

    // Buscar en planes personalizados
    const perIdx = config.personalized.findIndex((p) => p.id === planId);
    if (perIdx !== -1) {
      const plan = config.personalized[perIdx];
      const updated: MembershipPlan = {
        ...plan,
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.price !== undefined && { price: changes.price }),
      };
      config.personalized[perIdx] = updated;
      await this.storageService.set<CostsConfig>(COSTS_KEY, config);
      return updated;
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Lógica de negocio
  // ---------------------------------------------------------------------------

  /**
   * Determina si un plan es de tipo "single" (clase única).
   * Los planes single NO extienden la fecha de suscripción al registrar pago.
   *
   * Requirement 4.4: Clase única no extiende subscriptionEndDate.
   */
  static isSingleClass(plan: MembershipPlan): boolean {
    return plan.single === true;
  }

  /**
   * Calcula la fecha de vencimiento extendida para un pago de mensualidad normal.
   *
   * La lógica es: la nueva fecha es max(oldSubscriptionEndDate, paymentDate) + 1 mes.
   * Para planes single, retorna la fecha original sin cambios.
   *
   * @param currentEndDate Fecha actual de vencimiento del estudiante (ISO string).
   * @param paymentDate Fecha del pago (ISO string).
   * @param plan El plan al que corresponde el pago.
   * @returns La nueva fecha de vencimiento (ISO string), o la original si es single.
   */
  static calculateNewEndDate(
    currentEndDate: string,
    paymentDate: string,
    plan: MembershipPlan,
  ): string {
    if (MembershipService.isSingleClass(plan)) {
      return currentEndDate;
    }

    const endDate = new Date(currentEndDate);
    const payDate = new Date(paymentDate);

    // Usar la mayor de las dos fechas como base
    const baseDate = endDate.getTime() > payDate.getTime() ? new Date(endDate) : new Date(payDate);

    // Extender 1 mes
    baseDate.setMonth(baseDate.getMonth() + 1);

    return baseDate.toISOString().split('T')[0];
  }

  /**
   * Retorna los planes por defecto sin necesidad de storage.
   * Útil para resetear la configuración.
   */
  static getDefaultConfig(): CostsConfig {
    return {
      memberships: [...DEFAULT_GROUP_PLANS],
      personalized: [...DEFAULT_PERSONALIZED_PLANS],
    };
  }

  /**
   * Restaura la configuración a los planes por defecto.
   */
  async resetToDefaults(): Promise<CostsConfig> {
    const defaults = MembershipService.getDefaultConfig();
    await this.storageService.set<CostsConfig>(COSTS_KEY, defaults);
    return defaults;
  }
}
