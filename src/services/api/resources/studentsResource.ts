/**
 * studentsResource — Handler REST para la clave 'students'.
 *
 * StudentService lee/escribe un Student[] bajo la clave 'students'. Este handler
 * traduce:
 *   get('students')            → GET /students        (+ apiToStudent)
 *   set('students', students)  → diff contra el remoto → POST/PUT/DELETE /students
 *
 * Estrategia de escritura (diff-sync): como el servicio persiste la colección
 * completa, comparamos el array entrante contra el snapshot remoto por id:
 *   - id nuevo (no está en remoto)      → POST /students
 *   - id existente con cambios          → PUT /students/{id}
 *   - id remoto ausente en el entrante  → DELETE /students/{id}
 *
 * Los bonos de cortesía y el consentimiento van embebidos en Student en el
 * frontend; la API los gestiona en sus propios recursos (/courtesies, /consent),
 * por lo que aquí NO se sincronizan (se preservan vía merge en lectura).
 *
 * @see gym-sass-infra/docs/API.md — Students Lambda
 */

import { api } from '../apiClient';
import type { ResourceHandler } from './types';
import type { Student } from '@/types/student';
import {
  apiToStudent,
  studentToApi,
  type ApiStudent,
} from '../mappers/studentMapper';

/** Campos relevantes para detectar si un Student cambió respecto al remoto. */
const DIFF_FIELDS: (keyof Student)[] = [
  'firstName',
  'lastName',
  'documentId',
  'phone',
  'email',
  'dateOfBirth',
  'bloodType',
  'beltRank',
  'planName',
  'planId',
  'planCategory',
  'monthlyFee',
  'subscriptionEndDate',
  'isMinor',
  'guardianName',
  'guardianDocument',
  'medicalNotes',
  'photo',
  'status',
  'telegramChatId',
];

/** true si dos estudiantes difieren en algún campo gestionado por la API. */
function hasChanges(next: Student, prev: Student): boolean {
  return DIFF_FIELDS.some((field) => next[field] !== prev[field]);
}

export class StudentsResource implements ResourceHandler {
  /** Cache del último snapshot remoto, por id, para el merge en lectura. */
  private lastById = new Map<string, Student>();

  async get<T>(): Promise<T | null> {
    const apiStudents = await api.get<ApiStudent[]>('/students');
    const list = Array.isArray(apiStudents) ? apiStudents : [];

    const students = list.map((s) => {
      const mapped = apiToStudent(s, this.lastById.get(s.id));
      return mapped;
    });

    this.lastById = new Map(students.map((s) => [s.id, s]));
    return students as T;
  }

  async set<T>(value: T): Promise<void> {
    const desired = (Array.isArray(value) ? value : []) as Student[];

    // Snapshot remoto actual (para el diff). Si falla, propaga el error.
    const remote = await api.get<ApiStudent[]>('/students');
    const remoteList = Array.isArray(remote) ? remote : [];
    const remoteById = new Map(remoteList.map((s) => [s.id, apiToStudent(s)]));
    const desiredIds = new Set(desired.map((s) => s.id));

    // Creaciones y actualizaciones.
    for (const student of desired) {
      const prev = remoteById.get(student.id);
      if (!prev) {
        // Nuevo: la API asigna el id (usa documentId como id en su modelo).
        await api.post('/students', studentToApi(student));
      } else if (hasChanges(student, prev)) {
        await api.put(`/students/${encodeURIComponent(student.id)}`, studentToApi(student));
      }
    }

    // Eliminaciones: ids que estaban en remoto y ya no en el deseado.
    for (const student of remoteList) {
      if (!desiredIds.has(student.id)) {
        await api.delete(`/students/${encodeURIComponent(student.id)}`);
      }
    }

    // Refresca la cache para lecturas posteriores.
    this.lastById = new Map(desired.map((s) => [s.id, s]));
  }

  async remove(): Promise<void> {
    const remote = await api.get<ApiStudent[]>('/students');
    const remoteList = Array.isArray(remote) ? remote : [];
    for (const student of remoteList) {
      await api.delete(`/students/${encodeURIComponent(student.id)}`);
    }
    this.lastById.clear();
  }
}
