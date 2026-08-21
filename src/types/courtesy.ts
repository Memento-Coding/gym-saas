/**
 * Tipos para el módulo de cortesías.
 * Define la estructura de bonos de cortesía otorgados a estudiantes.
 */

export interface CourtesyBonus {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  weeks: number;
}
