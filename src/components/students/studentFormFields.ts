/**
 * Campos del formulario de estudiantes: catálogo del sistema y resolución de lo
 * que cada gimnasio configuró en Ajustes (`resolveStudentFields`).
 *
 * Lo que se guarda en Ajustes es una lista ordenada de campos (`formFields`):
 *  - el ORDEN de la lista es el orden del formulario;
 *  - un campo del sistema puede traer una etiqueta propia (alias); su `name`
 *    (clave interna) nunca cambia;
 *  - la entrada especial `adultsOnly` indica que el gimnasio solo atiende adultos
 *    y oculta el bloque de menor de edad / acudiente.
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

/** Clave del campo compuesto: se edita como nombre + teléfono (emergencyName/emergencyPhone). */
export const EMERGENCY_CONTACT_FIELD = 'emergencyContact';

/** Campos del sistema apagados por defecto, que un gimnasio puede activar. */
const OPTIONAL_STUDENT_FIELDS: FormFieldConfig[] = [
  { id: 'bloodType', name: 'bloodType', label: 'Tipo de sangre', type: 'select', required: false, isBuiltIn: true,
    options: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] },
  { id: 'beltRank', name: 'beltRank', label: 'Grado o cinturón', type: 'text', required: false, isBuiltIn: true },
  { id: 'medicalNotes', name: 'medicalNotes', label: 'Observaciones médicas', type: 'text', required: false, isBuiltIn: true },
  { id: EMERGENCY_CONTACT_FIELD, name: EMERGENCY_CONTACT_FIELD, label: 'Contacto de emergencia', type: 'text', required: false, isBuiltIn: true },
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
 * Marca guardada junto a los campos: el gimnasio solo atiende adultos. Existe solo
 * cuando está activa, así un gimnasio con configuración anterior sigue viendo el
 * bloque de menor de edad.
 */
export const ADULTS_ONLY_FIELD: FormFieldConfig = {
  id: 'adultsOnly',
  name: 'adultsOnly',
  label: 'Solo adultos',
  type: 'text',
  required: false,
  isBuiltIn: true,
};

/** ¿La configuración guardada oculta el bloque de menor de edad / acudiente? */
export function isAdultsOnly(saved: FormFieldConfig[]): boolean {
  return saved.some((f) => f.name === ADULTS_ONLY_FIELD.name);
}

/** Agrega o quita la marca `adultsOnly` de una lista de campos. */
export function withAdultsOnly(fields: FormFieldConfig[], adultsOnly: boolean): FormFieldConfig[] {
  const rest = fields.filter((f) => f.name !== ADULTS_ONLY_FIELD.name);
  return adultsOnly ? [...rest, ADULTS_ONLY_FIELD] : rest;
}

/**
 * Convierte lo guardado en Ajustes en los campos que muestra el formulario, en el
 * orden guardado. La definición de los campos del sistema siempre sale del
 * catálogo; de lo guardado solo se toma si se piden, si son obligatorios y la
 * etiqueta propia (si no hay, se usa la original). Sin configuración de campos
 * del sistema (gimnasio nuevo o solo con campos propios) se usan los de por
 * defecto y los propios van al final.
 */
export function resolveStudentFields(saved: FormFieldConfig[]): FormFieldConfig[] {
  const catalog = new Map(STUDENT_FIELD_CATALOG.map((f) => [f.name, f]));
  const configured = saved.some((f) => f.name === 'firstName');
  const seen = new Set<string>();

  const resolved: FormFieldConfig[] = [];
  const custom: FormFieldConfig[] = [];

  for (const field of saved) {
    if (field.name === ADULTS_ONLY_FIELD.name || seen.has(field.name)) continue;
    seen.add(field.name);

    const base = catalog.get(field.name);
    if (!base) {
      const entry = { ...field, isBuiltIn: false };
      (configured ? resolved : custom).push(entry);
      continue;
    }
    if (!configured) continue; // Sin configuración del sistema, mandan los defaults.
    resolved.push({
      ...base,
      label: field.label?.trim() || base.label,
      required: LOCKED_STUDENT_FIELDS.has(base.name) ? base.required : field.required,
    });
  }

  if (!configured) {
    return [...DEFAULT_STUDENT_FIELDS.map((f) => ({ ...f })), ...custom];
  }

  // Los campos que siempre se piden y faltan en lo guardado vuelven a su lugar
  // del catálogo (tras el campo bloqueado/por defecto anterior que sí esté).
  for (const field of DEFAULT_STUDENT_FIELDS) {
    if (!LOCKED_STUDENT_FIELDS.has(field.name) || seen.has(field.name)) continue;
    const index = DEFAULT_STUDENT_FIELDS.findIndex((f) => f.name === field.name);
    const previous = DEFAULT_STUDENT_FIELDS.slice(0, index)
      .map((f) => f.name)
      .reverse()
      .map((name) => resolved.findIndex((r) => r.name === name))
      .find((i) => i >= 0);
    resolved.splice(previous === undefined ? 0 : previous + 1, 0, { ...field });
  }

  return resolved;
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
