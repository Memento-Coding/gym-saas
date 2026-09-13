/**
 * courtesiesApi — Acceso REST directo al recurso /courtesies.
 *
 * En el frontend los bonos de cortesía viven EMBEBIDOS dentro de Student
 * (Student.courtesyBonuses), persistidos bajo la clave 'students'. La API, en
 * cambio, modela las cortesías como una entidad propia (/courtesies) asociada a
 * un studentId.
 *
 * Por eso no hay un ResourceHandler por clave para cortesías: se expone este
 * módulo con funciones directas que la capa de cortesías usa cuando isApiMode()
 * es true, para crear/listar/eliminar bonos contra el backend y luego reflejar
 * el resultado en el Student local.
 *
 * @see gym-sass-infra/docs/API.md — Courtesies Lambda
 * @see gym-sass-infra/docs/DATA-MODEL.md — courtesies (GSI_Student, GSI_Status)
 */

import { api } from '../apiClient';
import type { CourtesyBonus } from '@/types/courtesy';

interface ApiCourtesy {
  id: string;
  studentId?: string;
  studentName?: string;
  startDate?: string;
  endDate?: string;
  weeks?: number;
  reason?: string;
  status?: string;
}

/** Mapea una cortesía de la API al bono del frontend. */
function apiToBonus(c: ApiCourtesy): CourtesyBonus {
  return {
    id: c.id,
    startDate: c.startDate ?? '',
    endDate: c.endDate ?? '',
    reason: c.reason ?? '',
    weeks: c.weeks ?? 0,
  };
}

/** Lista todas las cortesías (opcionalmente filtrables por estudiante en memoria). */
export async function listApiCourtesies(): Promise<ApiCourtesy[]> {
  const list = await api.get<ApiCourtesy[]>('/courtesies');
  return Array.isArray(list) ? list : [];
}

/** Bonos de cortesía de un estudiante concreto. */
export async function listApiCourtesiesByStudent(
  studentId: string,
): Promise<CourtesyBonus[]> {
  const list = await listApiCourtesies();
  return list.filter((c) => c.studentId === studentId).map(apiToBonus);
}

/** Crea un bono de cortesía en la API. El backend calcula endDate. */
export async function createApiCourtesy(
  studentId: string,
  studentName: string,
  input: { startDate: string; weeks: number; reason: string },
): Promise<CourtesyBonus> {
  const created = await api.post<ApiCourtesy>('/courtesies', {
    studentId,
    studentName,
    startDate: input.startDate,
    weeks: input.weeks,
    reason: input.reason,
  });
  return apiToBonus(created);
}

/** Elimina un bono de cortesía por su id compuesto (studentId-startDate). */
export async function deleteApiCourtesy(courtesyId: string): Promise<void> {
  await api.delete(`/courtesies/${encodeURIComponent(courtesyId)}`);
}
