/**
 * Tipos para el módulo de membresías.
 * Define los planes de membresía y la configuración de costos.
 */

export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  single?: boolean;
  classesPerMonth?: number;
}

export interface CostsConfig {
  memberships: MembershipPlan[];
  personalized: MembershipPlan[];
}
