/**
 * Sanitización de entrada en tiempo real, compartida por los formularios.
 *
 * Quita al escribir (o pegar) lo que un campo numérico nunca admite. Conserva
 * `.` y `-` a propósito: los decimales y negativos los rechaza la validación
 * (Zod) con su mensaje, al salir del campo (`mode: 'onTouched'`).
 */
export function sanitizeNumericInput(value: string): string {
  return value.replace(/[^\d.-]/g, '');
}
