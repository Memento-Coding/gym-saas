/**
 * StudentService — Lógica de negocio para el módulo de estudiantes.
 *
 * Encapsula todas las operaciones CRUD sobre estudiantes, además de las reglas
 * de negocio de clasificación de estado, búsqueda y filtrado.
 *
 * Persistencia: delega en el StorageService unificado (IndexedDB + localStorage),
 * accedido de forma perezosa vía getStorageService(). Todos los estudiantes se
 * almacenan bajo una única clave como un array.
 *
 * Manejo de errores: las operaciones que pueden fallar retornan un resultado
 * discriminado ServiceResult para forzar el manejo explícito en el llamador.
 */

import type { Student } from '../types/student';
import { getStorageService } from './storage/StorageService';

/** Clave de almacenamiento donde persiste la colección de estudiantes. */
const STORAGE_KEY = 'gymops_students';

/** Milisegundos en un día — usado para cálculos de fechas. */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Resultado discriminado para operaciones que pueden fallar.
 * Permite al llamador distinguir éxito/error de forma type-safe.
 */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Estado de pago derivado de la fecha de vencimiento de la suscripción. */
export type PaymentStatus = 'al_dia' | 'por_vencer' | 'vencido';

/** Grupo etario derivado del flag isMinor. */
export type AgeGroup = 'menor' | 'adulto';

/** Criterios opcionales de filtrado de estudiantes. */
export interface StudentFilterCriteria {
  paymentStatus?: PaymentStatus;
  ageGroup?: AgeGroup;
}

/** Datos requeridos para registrar un estudiante (id y status se generan/derivan). */
export type StudentRegistration = Omit<Student, 'id' | 'status'>;

/**
 * Servicio de estudiantes. Sin estado propio: toda la persistencia vive en el
 * StorageService. Se exporta como instancia singleton al final del archivo.
 */
export class StudentService {
  // ---------------------------------------------------------------------------
  // Persistencia interna
  // ---------------------------------------------------------------------------

  /** Lee la colección cruda de estudiantes desde el almacenamiento. */
  private async read(): Promise<Student[]> {
    const storage = await getStorageService();
    const students = await storage.get<Student[]>(STORAGE_KEY);
    return students ?? [];
  }

  /** Persiste la colección completa de estudiantes. */
  private async write(students: Student[]): Promise<void> {
    const storage = await getStorageService();
    await storage.set<Student[]>(STORAGE_KEY, students);
  }

  // ---------------------------------------------------------------------------
  // Reglas de negocio: clasificación de estado (Req 3.4 y 3.5)
  // ---------------------------------------------------------------------------

  /**
   * Evalúa el estado real de un estudiante según el tiempo actual.
   *
   * Prioridad:
   *  1. 'frozen'   — si tiene freezeEndDate en el futuro (congelación explícita).
   *  2. 'inactive' — si la suscripción venció hace más de 15 días.
   *  3. 'active'   — en cualquier otro caso.
   *
   * @param student Estudiante a evaluar.
   * @param now     Fecha de referencia (inyectable para pruebas). Por defecto, ahora.
   */
  private evaluateStatus(
    student: Student,
    now: Date = new Date(),
  ): Student['status'] {
    // 1. Congelación explícita vigente.
    if (student.freezeEndDate) {
      const freezeEnd = new Date(student.freezeEndDate);
      if (!Number.isNaN(freezeEnd.getTime()) && freezeEnd.getTime() > now.getTime()) {
        return 'frozen';
      }
    }

    // 2. Auto-desactivación: más de 15 días de atraso en la suscripción.
    if (student.subscriptionEndDate) {
      const subEnd = new Date(student.subscriptionEndDate);
      if (!Number.isNaN(subEnd.getTime())) {
        const daysOverdue = (now.getTime() - subEnd.getTime()) / MS_PER_DAY;
        if (daysOverdue > 15) {
          return 'inactive';
        }
      }
    }

    // 3. Activo por defecto.
    return 'active';
  }

  /** Devuelve una copia del estudiante con su status recalculado al momento actual. */
  private withEvaluatedStatus(student: Student, now: Date = new Date()): Student {
    return { ...student, status: this.evaluateStatus(student, now) };
  }

  // ---------------------------------------------------------------------------
  // Operaciones CRUD
  // ---------------------------------------------------------------------------

  /**
   * Registra un nuevo estudiante.
   *
   * Reglas:
   *  - Genera un id único (crypto.randomUUID()).
   *  - Valida que el documentId no exista previamente (Req 3.3).
   *  - Calcula el status inicial mediante evaluateStatus.
   *
   * @param student Datos del estudiante sin id ni status.
   * @returns El estudiante creado, o un error si el documento ya existe.
   */
  async register(student: StudentRegistration): Promise<ServiceResult<Student>> {
    try {
      const students = await this.read();

      // Validación de documento único (Req 3.3).
      const duplicate = students.some(
        (s) => s.documentId === student.documentId,
      );
      if (duplicate) {
        return { success: false, error: 'El documento ya se encuentra registrado.' };
      }

      const base: Student = {
        ...(student as Student),
        id: crypto.randomUUID(),
        status: 'active',
      };
      const newStudent: Student = this.withEvaluatedStatus(base);

      await this.write([...students, newStudent]);
      return { success: true, data: newStudent };
    } catch (error) {
      return { success: false, error: this.toErrorMessage(error) };
    }
  }

  /**
   * Actualiza un estudiante existente por id.
   *
   * El id nunca se sobrescribe. El status se recalcula tras la actualización.
   *
   * @param id   Identificador del estudiante.
   * @param data Campos parciales a actualizar.
   * @returns El estudiante actualizado, o un error si no existe.
   */
  async update(id: string, data: Partial<Student>): Promise<ServiceResult<Student>> {
    try {
      const students = await this.read();
      const index = students.findIndex((s) => s.id === id);

      if (index === -1) {
        return { success: false, error: 'Estudiante no encontrado.' };
      }

      const merged: Student = { ...students[index], ...data, id };
      const updated: Student = this.withEvaluatedStatus(merged);

      const next = [...students];
      next[index] = updated;
      await this.write(next);

      return { success: true, data: updated };
    } catch (error) {
      return { success: false, error: this.toErrorMessage(error) };
    }
  }

  /**
   * Elimina un estudiante por id.
   *
   * @param id Identificador del estudiante.
   * @returns success con el id eliminado, o un error si no existe.
   */
  async delete(id: string): Promise<ServiceResult<string>> {
    try {
      const students = await this.read();
      const next = students.filter((s) => s.id !== id);

      if (next.length === students.length) {
        return { success: false, error: 'Estudiante no encontrado.' };
      }

      await this.write(next);
      return { success: true, data: id };
    } catch (error) {
      return { success: false, error: this.toErrorMessage(error) };
    }
  }

  /**
   * Retorna todos los estudiantes con su status recalculado al momento actual
   * (Req 3.4 y 3.5).
   */
  async getAll(): Promise<Student[]> {
    const now = new Date();
    const students = await this.read();
    return students.map((s) => this.withEvaluatedStatus(s, now));
  }

  /**
   * Retorna un estudiante por id con su status recalculado, o null si no existe.
   */
  async getById(id: string): Promise<Student | null> {
    const students = await this.read();
    const student = students.find((s) => s.id === id);
    return student ? this.withEvaluatedStatus(student) : null;
  }

  // ---------------------------------------------------------------------------
  // Búsqueda y filtrado (Req 3.6 y 3.7)
  // ---------------------------------------------------------------------------

  /**
   * Búsqueda por substring insensible a mayúsculas/minúsculas sobre
   * firstName, lastName, documentId y phone.
   *
   * @param query    Texto a buscar. Vacío devuelve todos los estudiantes.
   * @param students Colección opcional sobre la que buscar. Si se omite, se leen
   *                 todos los estudiantes (con status evaluado).
   */
  async search(query: string, students?: Student[]): Promise<Student[]> {
    const source = students ?? (await this.getAll());
    const term = query.trim().toLowerCase();

    if (term === '') {
      return source;
    }

    return source.filter((s) => {
      const haystack = [s.firstName, s.lastName, s.documentId, s.phone]
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.toLowerCase());
      return haystack.some((field) => field.includes(term));
    });
  }

  /**
   * Filtra estudiantes por estado de pago y/o grupo etario (Req 3.7).
   *
   * Definiciones (relativas a la fecha actual):
   *  - al_dia:    subscriptionEndDate > hoy + 3 días.
   *  - por_vencer: subscriptionEndDate está a 3 días o menos de vencer (incluye hoy).
   *  - vencido:   subscriptionEndDate < hoy.
   *  - menor:     isMinor === true.
   *  - adulto:    isMinor === false.
   *
   * @param criteria Criterios de filtrado. Campos omitidos no restringen.
   * @param students Colección opcional. Si se omite, se leen todos los estudiantes.
   */
  async filter(
    criteria: StudentFilterCriteria,
    students?: Student[],
  ): Promise<Student[]> {
    const source = students ?? (await this.getAll());
    const now = new Date();

    return source.filter((s) => {
      if (criteria.ageGroup && this.getAgeGroup(s) !== criteria.ageGroup) {
        return false;
      }
      if (
        criteria.paymentStatus &&
        this.getPaymentStatus(s, now) !== criteria.paymentStatus
      ) {
        return false;
      }
      return true;
    });
  }

  /** Deriva el grupo etario de un estudiante. */
  private getAgeGroup(student: Student): AgeGroup {
    return student.isMinor ? 'menor' : 'adulto';
  }

  /**
   * Deriva el estado de pago según la distancia entre subscriptionEndDate y hoy.
   * Fechas inválidas/ausentes se tratan como 'vencido'.
   */
  private getPaymentStatus(student: Student, now: Date = new Date()): PaymentStatus {
    const subEnd = new Date(student.subscriptionEndDate);
    if (Number.isNaN(subEnd.getTime())) {
      return 'vencido';
    }

    const diffDays = (subEnd.getTime() - now.getTime()) / MS_PER_DAY;

    if (diffDays < 0) {
      return 'vencido';
    }
    if (diffDays > 3) {
      return 'al_dia';
    }
    // 0 <= diffDays <= 3 (a 3 días o menos de vencer, incluyendo hoy).
    return 'por_vencer';
  }

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------

  /** Normaliza cualquier valor lanzado a un mensaje de error legible. */
  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Ocurrió un error inesperado al procesar la operación.';
  }
}

/** Instancia singleton lista para usar en toda la aplicación. */
export const studentService = new StudentService();
