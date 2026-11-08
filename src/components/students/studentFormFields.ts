/**
 * Campos del formulario de estudiantes: catálogo del sistema y resolución de lo
 * que cada gimnasio configuró en Ajustes (`resolveStudentFields`).
 */

import type { FormFieldConfig } from '@/types/settings';
import type { Student } from '@/types/student';

export const DEFAULT_STUDENT_FIELDS: FormFieldConfig[] = [
  { id: 'firstName', name: 'firstName', label: 'Nombres', type: 'text', required: true, isBuiltIn: true },
  { id: 'lastName', name: 'lastName', label: 'Apellidos', type: 'text', required: true, isBuiltIn: true },
  { id: 'documentId', name: 'documentId', label: 'Documento', type: 'text', required: true, isBuiltIn: true },
  { id: 'phone', name: 'phone', label: 'Teléfono', type: 'tel', required: false, isBuiltIn: true },
  { id: 'email', name: 'email', label: 'Email', type: 'email', required: false, isBuiltIn: true },
  { id: 'dateOfBirth', name: 'dateOfBirth', label: 'Fecha de nacimiento', type: 'date', required: false, isBuiltIn: true },
  // Las opciones son los planes del gimnasio: las inyecta StudentForm.
  { id: 'planName', name: 'planName', label: 'Plan', type: 'select', required: true, isBuiltIn: true },
  { id: 'monthlyFee', name: 'monthlyFee', label: 'Mensualidad', type: 'number', required: false, isBuiltIn: true },
  { id: 'subscriptionEndDate', name: 'subscriptionEndDate', label: 'Vencimiento', type: 'date', required: true, isBuiltIn: true },
];

/** Campos del sistema apagados por defecto, que un gimnasio puede activar. */
const OPTIONAL_STUDENT_FIELDS: FormFieldConfig[] = [
  { id: 'bloodType', name: 'bloodType', label: 'Tipo de sangre', type: 'select', required: false, isBuiltIn: true,
    options: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] },
  { id: 'beltRank', name: 'beltRank', label: 'Grado o cinturón', type: 'text', required: false, isBuiltIn: true },
  { id: 'medicalNotes', name: 'medicalNotes', label: 'Observaciones médicas', type: 'text', required: false, isBuiltIn: true },
];

export const STUDENT_FIELD_CATALOG = [...DEFAULT_STUDENT_FIELDS, ...OPTIONAL_STUDENT_FIELDS];

/** Siempre se piden: la API, los pagos y el estado de membresía dependen de ellos. */
export const LOCKED_STUDENT_FIELDS = new Set([
  'firstName',
  'lastName',
  'documentId',
  'planName',
  'subscriptionEndDate',
]);

/**
 * Convierte lo guardado en Ajustes en los campos que muestra el formulario: la
 * definición de los campos del sistema siempre sale del catálogo y de lo guardado
 * solo se toma si se piden y si son obligatorios. Sin configuración de campos del
 * sistema (gimnasio nuevo o solo con campos propios) se usan los de por defecto.
 */
export function resolveStudentFields(saved: FormFieldConfig[]): FormFieldConfig[] {
  const byName = new Map(saved.map((f) => [f.name, f]));
  const configured = byName.has('firstName');

  const builtIn = STUDENT_FIELD_CATALOG.flatMap((field) => {
    if (LOCKED_STUDENT_FIELDS.has(field.name)) return [field];
    if (!configured) return DEFAULT_STUDENT_FIELDS.includes(field) ? [field] : [];
    const choice = byName.get(field.name);
    return choice ? [{ ...field, required: choice.required }] : [];
  });

  const catalogNames = new Set(STUDENT_FIELD_CATALOG.map((f) => f.name));
  const custom = saved
    .filter((f) => !catalogNames.has(f.name))
    .map((f) => ({ ...f, isBuiltIn: false }));

  return [...builtIn, ...custom];
}

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
