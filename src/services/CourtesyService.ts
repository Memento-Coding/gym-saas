/**
 * CourtesyService — Gestión de bonos de cortesía.
 *
 * Responsabilidades:
 * - Registrar bonos de cortesía con fecha inicio, fin, razón y duración en semanas
 * - Asociar bonos al perfil del estudiante SIN modificar subscriptionEndDate
 * - Consultar bonos por estudiante y globalmente agrupados por estudiante
 * - Eliminar bonos existentes
 *
 * Requirements: 13.1, 13.2, 13.3
 */

import type { StorageService } from '@/services/storage/StorageService';
import type { Student } from '@/types/student';
import type { CourtesyBonus } from '@/types/courtesy';

/** Storage key for students */
const STUDENTS_KEY = 'students';

export interface CourtesyBonusInput {
  startDate: string;
  reason: string;
  weeks: number;
}

export interface StudentBonusGroup {
  studentId: string;
  studentName: string;
  bonuses: CourtesyBonus[];
}

export class CourtesyService {
  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  /**
   * Registra un bono de cortesía para un estudiante.
   * Calcula endDate a partir de startDate + weeks.
   * NO modifica subscriptionEndDate del estudiante.
   *
   * Requirement 13.1: Registrar bonos con fecha inicio, fin, razón y duración en semanas
   * Requirement 13.3: No modifica la fecha de vencimiento de membresía
   */
  async addBonus(studentId: string, input: CourtesyBonusInput): Promise<Student> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) {
      throw new Error('No se encontraron estudiantes registrados.');
    }

    const studentIndex = students.findIndex((s) => s.id === studentId);
    if (studentIndex === -1) {
      throw new Error(`Estudiante con id "${studentId}" no encontrado.`);
    }

    const student = students[studentIndex];

    // Calculate endDate from startDate + weeks
    const startDate = new Date(input.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + input.weeks * 7);

    const bonus: CourtesyBonus = {
      id: crypto.randomUUID(),
      startDate: input.startDate,
      endDate: endDate.toISOString().split('T')[0],
      reason: input.reason,
      weeks: input.weeks,
    };

    const updatedStudent: Student = {
      ...student,
      courtesyBonuses: [...(student.courtesyBonuses ?? []), bonus],
      // subscriptionEndDate is intentionally NOT modified (Requirement 13.3)
    };

    students[studentIndex] = updatedStudent;
    await this.storageService.set<Student[]>(STUDENTS_KEY, students);

    return updatedStudent;
  }

  /**
   * Elimina un bono de cortesía de un estudiante.
   */
  async removeBonus(studentId: string, bonusId: string): Promise<Student> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) {
      throw new Error('No se encontraron estudiantes registrados.');
    }

    const studentIndex = students.findIndex((s) => s.id === studentId);
    if (studentIndex === -1) {
      throw new Error(`Estudiante con id "${studentId}" no encontrado.`);
    }

    const student = students[studentIndex];
    const bonusExists = (student.courtesyBonuses ?? []).some((b) => b.id === bonusId);
    if (!bonusExists) {
      throw new Error(`Bono con id "${bonusId}" no encontrado para este estudiante.`);
    }

    const updatedStudent: Student = {
      ...student,
      courtesyBonuses: (student.courtesyBonuses ?? []).filter((b) => b.id !== bonusId),
    };

    students[studentIndex] = updatedStudent;
    await this.storageService.set<Student[]>(STUDENTS_KEY, students);

    return updatedStudent;
  }

  /**
   * Obtiene todos los bonos de un estudiante específico.
   */
  async getBonusesByStudent(studentId: string): Promise<CourtesyBonus[]> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) {
      return [];
    }

    const student = students.find((s) => s.id === studentId);
    if (!student) {
      throw new Error(`Estudiante con id "${studentId}" no encontrado.`);
    }

    return student.courtesyBonuses ?? [];
  }

  /**
   * Obtiene todos los bonos agrupados por estudiante.
   * Retorna solo estudiantes que tienen al menos un bono registrado.
   *
   * Requirement 13.2: Lista consolidada de bonos agrupados por estudiante
   */
  async getAllBonuses(): Promise<StudentBonusGroup[]> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) {
      return [];
    }

    return students
      .filter((s) => (s.courtesyBonuses ?? []).length > 0)
      .map((s) => ({
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        bonuses: s.courtesyBonuses ?? [],
      }));
  }
}
