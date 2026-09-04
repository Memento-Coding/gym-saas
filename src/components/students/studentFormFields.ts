/**
 * Configuración de campos por defecto para el formulario de estudiantes.
 *
 * En ausencia (todavía) de un módulo de Ajustes que persista los FormFieldConfig,
 * este set de campos "built-in" alimenta al StudentForm. Cuando exista un
 * SettingsService, bastará con reemplazar esta fuente por la configuración real.
 */

import type { FormFieldConfig } from '@/types/settings';
import type { Student } from '@/types/student';

export const DEFAULT_STUDENT_FIELDS: FormFieldConfig[] = [
  { id: 'firstName', name: 'firstName', label: 'Nombres', type: 'text', required: true, isBuiltIn: true },
  { id: 'lastName', name: 'lastName', label: 'Apellidos', type: 'text', required: true, isBuiltIn: true },
  { id: 'documentId', name: 'documentId', label: 'Documento', type: 'text', required: true, isBuiltIn: true },
  { id: 'phone', name: 'phone', label: 'Teléfono', type: 'text', required: false, isBuiltIn: true },
  { id: 'email', name: 'email', label: 'Email', type: 'text', required: false, isBuiltIn: true },
  { id: 'dateOfBirth', name: 'dateOfBirth', label: 'Fecha de nacimiento', type: 'date', required: false, isBuiltIn: true },
  { id: 'planName', name: 'planName', label: 'Plan', type: 'select', required: true, isBuiltIn: true,
    options: ['Plan Básico genérico', 'Plan Estándar genérico', 'Plan Premium genérico'] },
  { id: 'monthlyFee', name: 'monthlyFee', label: 'Mensualidad', type: 'number', required: false, isBuiltIn: true },
  { id: 'subscriptionEndDate', name: 'subscriptionEndDate', label: 'Vencimiento', type: 'date', required: true, isBuiltIn: true },
];

/**
 * Valores base para completar un Student nuevo a partir de los datos parciales
 * del formulario, garantizando que todos los campos requeridos del modelo
 * existan (aunque vacíos). No incluye id ni status (los deriva el servicio).
 */
export function buildStudentDefaults(): Omit<Student, 'id' | 'status'> {
  const today = new Date().toISOString().split('T')[0];
  return {
    photo: '',
    firstName: '',
    lastName: '',
    documentId: '',
    isMinor: false,
    guardianName: '',
    guardianDocument: '',
    phone: '',
    email: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    dateOfBirth: '',
    bloodType: '',
    firstRegistrationDate: today,
    recentRegistrationDate: today,
    registrationDate: today,
    subscriptionEndDate: today,
    monthlyFee: 0,
    planCategory: 'mensualidad',
    planName: '',
    planId: '',
    payments: [],
    courtesyBonuses: [],
    medicalNotes: '',
    beltRank: '',
    consent: {
      signed: false,
      signedDate: '',
      signedVersion: 0,
      signature: '',
    },
  };
}
