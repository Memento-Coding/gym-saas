/**
 * ConsentService — Gestión de consentimiento informado versionado.
 *
 * Responsabilidades:
 * - Mantener dos versiones del texto (adultos y menores)
 * - Versionar el documento con número incremental y fecha
 * - Marcar a todos los estudiantes como pendientes al actualizar versión
 * - Permitir firma diferida para menores sin presencia de acudiente
 * - Mantener historial de firmas previas al re-firmar
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5, 6.7
 */

import type { StorageService } from '@/services/storage/StorageService';
import type { ConsentConfig, ConsentRecord, ConsentHistoryEntry } from '@/types/consent';
import type { Student } from '@/types/student';

/** Storage key for consent configuration */
const CONSENT_CONFIG_KEY = 'consent_config';

/** Storage key for students */
const STUDENTS_KEY = 'students';

/** Default consent config when none exists */
const DEFAULT_CONSENT_CONFIG: ConsentConfig = {
  version: 1,
  updatedDate: new Date().toISOString(),
  text: '',
  minorText: '',
};

export class ConsentService {
  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  /**
   * Obtiene la configuración actual del consentimiento.
   * Si no existe, retorna una configuración por defecto con versión 1.
   *
   * Requirement 6.1: Mantiene textos separados para adultos y menores
   * Requirement 6.2: Incluye versión y fecha de actualización
   */
  async getConsentConfig(): Promise<ConsentConfig> {
    const config = await this.storageService.get<ConsentConfig>(CONSENT_CONFIG_KEY);
    return config ?? { ...DEFAULT_CONSENT_CONFIG, updatedDate: new Date().toISOString() };
  }

  /**
   * Actualiza la versión del consentimiento con nuevos textos.
   * Incrementa la versión y marca a todos los estudiantes como pendientes de firma.
   *
   * Requirement 6.2: Versiona con número incremental y fecha
   * Requirement 6.3: Marca a todos los estudiantes como pendientes
   */
  async updateConsentVersion(text: string, minorText: string): Promise<ConsentConfig> {
    const currentConfig = await this.getConsentConfig();

    const newConfig: ConsentConfig = {
      version: currentConfig.version + 1,
      updatedDate: new Date().toISOString(),
      text,
      minorText,
    };

    await this.storageService.set<ConsentConfig>(CONSENT_CONFIG_KEY, newConfig);

    // Marcar a todos los estudiantes como pendientes de nueva firma
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (students && students.length > 0) {
      const updatedStudents = students.map((student) => ({
        ...student,
        consent: {
          ...student.consent,
          signed: false,
        },
      }));
      await this.storageService.set<Student[]>(STUDENTS_KEY, updatedStudents);
    }

    return newConfig;
  }

  /**
   * Firma el consentimiento para un estudiante.
   * Si el estudiante ya tenía una firma previa, la mueve al historial.
   *
   * Requirement 6.7: Mantiene historial de firmas previas al re-firmar
   */
  async signConsent(
    studentId: string,
    signature: string,
    byGuardian?: boolean,
    mediaAuth?: boolean,
  ): Promise<Student> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) {
      throw new Error('No se encontraron estudiantes registrados.');
    }

    const studentIndex = students.findIndex((s) => s.id === studentId);
    if (studentIndex === -1) {
      throw new Error(`Estudiante con id "${studentId}" no encontrado.`);
    }

    const student = students[studentIndex];
    const currentConfig = await this.getConsentConfig();
    const now = new Date().toISOString();

    // Construir historial: preservar el existente + agregar firma previa si existe
    const history: ConsentHistoryEntry[] = [...(student.consent.history ?? [])];

    if (student.consent.signed && student.consent.signature) {
      history.push({
        signedDate: student.consent.signedDate,
        signedVersion: student.consent.signedVersion,
        signature: student.consent.signature,
      });
    }

    const updatedConsent: ConsentRecord = {
      signed: true,
      signedDate: now,
      signedVersion: currentConfig.version,
      signature,
      mediaAuth: mediaAuth ?? student.consent.mediaAuth,
      byGuardian: byGuardian ?? false,
      history: history.length > 0 ? history : undefined,
    };

    const updatedStudent: Student = {
      ...student,
      consent: updatedConsent,
    };

    students[studentIndex] = updatedStudent;
    await this.storageService.set<Student[]>(STUDENTS_KEY, students);

    return updatedStudent;
  }

  /**
   * Difiere la firma del consentimiento para un menor sin presencia del acudiente.
   * Marca el consentimiento como pendiente (signed: false) sin borrar historial previo.
   *
   * Requirement 6.5: Permite diferir la firma para menores sin acudiente
   */
  async deferConsent(studentId: string): Promise<Student> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) {
      throw new Error('No se encontraron estudiantes registrados.');
    }

    const studentIndex = students.findIndex((s) => s.id === studentId);
    if (studentIndex === -1) {
      throw new Error(`Estudiante con id "${studentId}" no encontrado.`);
    }

    const student = students[studentIndex];

    const updatedConsent: ConsentRecord = {
      ...student.consent,
      signed: false,
      signedDate: '',
      signedVersion: 0,
      signature: '',
    };

    const updatedStudent: Student = {
      ...student,
      consent: updatedConsent,
    };

    students[studentIndex] = updatedStudent;
    await this.storageService.set<Student[]>(STUDENTS_KEY, students);

    return updatedStudent;
  }

  /**
   * Verifica si el consentimiento de un estudiante está al día con la versión actual.
   * Retorna true si la firma corresponde a la versión vigente.
   */
  async getStudentConsentStatus(studentId: string): Promise<{
    upToDate: boolean;
    studentVersion: number;
    currentVersion: number;
    signed: boolean;
  }> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) {
      throw new Error('No se encontraron estudiantes registrados.');
    }

    const student = students.find((s) => s.id === studentId);
    if (!student) {
      throw new Error(`Estudiante con id "${studentId}" no encontrado.`);
    }

    const config = await this.getConsentConfig();

    return {
      upToDate: student.consent.signed && student.consent.signedVersion === config.version,
      studentVersion: student.consent.signedVersion,
      currentVersion: config.version,
      signed: student.consent.signed,
    };
  }

  /**
   * Retorna todos los estudiantes cuyo consentimiento no coincide con la versión actual.
   * Incluye estudiantes que no han firmado o cuya firma es de una versión anterior.
   *
   * Requirement 6.3: Permite identificar estudiantes pendientes tras actualización
   */
  async getAllPendingStudents(): Promise<Student[]> {
    const students = await this.storageService.get<Student[]>(STUDENTS_KEY);
    if (!students) {
      return [];
    }

    const config = await this.getConsentConfig();

    return students.filter(
      (student) => !student.consent.signed || student.consent.signedVersion !== config.version,
    );
  }
}
