/**
 * validation.ts — Catálogo de validaciones reutilizables (GymOps)
 * =============================================================================
 *
 * Fuente única de reglas de validación de formularios, alineada con
 * `docs/STEERING_FORMS.md`. Construido sobre Zod v4 para integrarse con
 * `react-hook-form` (`zodResolver`).
 *
 * Cubre:
 *  - Documentos: solo dígitos + unicidad (front) simulando consulta backend.
 *  - Montos monetarios: no negativos.
 *  - Enteros positivos y porcentajes: con límites.
 *  - Fechas: parseo/formateo UTC, integridad cronológica y cálculo de
 *    vencimiento a partir de fecha de pago + configuración del plan.
 *  - Selects: validación contra el array de datos de origen (catálogo real).
 *
 * Responsabilidades (ver STEERING_FORMS §0):
 *  - Front  → estos schemas (feedback inmediato, nunca autoridad única).
 *  - Back   → los *Service.ts revalidan con las MISMAS utilidades.
 *  - DB     → índice único / condition expression (futuro DynamoDB).
 */

import { z } from 'zod';

import type { StorageService } from '@/services/storage/StorageService';
import { getStorageService } from '@/services/storage/StorageService';
import type { MembershipPlan } from '@/types/membership';
import type { Student } from '@/types/student';

// =============================================================================
// Tipos compartidos
// =============================================================================

/**
 * Resultado discriminado consistente con el resto de servicios del proyecto
 * (`StudentService`, `PaymentService`).
 */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Clave de la colección de estudiantes en StorageService. */
const STUDENTS_KEY = 'students';

// =============================================================================
// Mensajes de error estandarizados (STEERING_FORMS §3)
// =============================================================================

export const messages = {
  required: (label: string) => `${label} es obligatorio.`,
  onlyDigits: (label: string) => `${label} solo puede contener números.`,
  negative: (label: string) => `${label} no puede ser negativo.`,
  range: (label: string, min: number, max: number) =>
    `${label} debe estar entre ${min} y ${max}.`,
  integer: (label: string) => `${label} debe ser un número entero.`,
  notInCatalog: (label: string) => `${label} no es una opción válida.`,
  invalidDate: (label: string) => `${label} no es una fecha válida.`,
  chronological: (startLabel: string, endLabel: string) =>
    `${endLabel} no puede ser anterior a ${startLabel}.`,
  futureDate: (label: string) => `${label} no puede ser una fecha futura.`,
  duplicate: (label: string) => `${label} ya se encuentra registrado.`,
} as const;

// =============================================================================
// 1. Documentos (solo dígitos + unicidad)
// =============================================================================

/** Regex de documento: solo dígitos, longitud razonable [4, 20]. */
const DOCUMENT_RE = /^\d{4,20}$/;

/**
 * Schema estricto de documento: cadena de solo dígitos (4–20).
 * Rechaza letras, espacios y caracteres especiales.
 */
export function documentSchema(label = 'El documento') {
  return z
    .string({ error: messages.required(label) })
    .trim()
    .min(1, { message: messages.required(label) })
    .regex(DOCUMENT_RE, { message: messages.onlyDigits(label) });
}

/** Predicado puro: ¿el documento tiene formato válido (solo dígitos)? */
export function isValidDocumentFormat(value: string): boolean {
  return DOCUMENT_RE.test(value.trim());
}

/**
 * Verifica unicidad de un documento contra una colección ya cargada.
 * Función pura (sin I/O), fácil de testear y reutilizar en el service (Back).
 *
 * @param document   Documento a verificar.
 * @param students   Colección de estudiantes existente.
 * @param excludeId  Id a excluir (modo edición: no colisiona consigo mismo).
 */
export function isDocumentUniqueIn(
  document: string,
  students: Pick<Student, 'id' | 'documentId'>[],
  excludeId?: string,
): boolean {
  const target = document.trim();
  return !students.some(
    (s) => s.documentId === target && s.id !== excludeId,
  );
}

/**
 * Valida unicidad de documento simulando una consulta a backend: lee la
 * colección desde `StorageService` (inyectable para tests) y compara.
 *
 * Devuelve un `ServiceResult<string>` con el documento normalizado si es único.
 */
export async function isDocumentUnique(
  document: string,
  storage?: StorageService,
  excludeId?: string,
): Promise<ServiceResult<string>> {
  const target = document.trim();

  if (!isValidDocumentFormat(target)) {
    return { success: false, error: messages.onlyDigits('El documento') };
  }

  const svc = storage ?? (await getStorageService());
  const students = (await svc.get<Student[]>(STUDENTS_KEY)) ?? [];

  if (!isDocumentUniqueIn(target, students, excludeId)) {
    return { success: false, error: messages.duplicate('El documento') };
  }

  return { success: true, data: target };
}

// =============================================================================
// 2. Montos monetarios (no negativos)
// =============================================================================

/**
 * Schema de monto monetario: número finito, no negativo. Acepta strings de
 * inputs (coerción) y rechaza NaN / negativos / no numéricos.
 *
 * @param label Etiqueta para los mensajes de error.
 * @param max   Tope defensivo del dominio (por defecto 10_000_000).
 */
export function nonNegativeAmount(label = 'El monto', max = 10_000_000) {
  return z.coerce
    .number({ error: messages.onlyDigits(label) })
    .refine((n) => Number.isFinite(n), { message: messages.onlyDigits(label) })
    .refine((n) => n >= 0, { message: messages.negative(label) })
    .refine((n) => n <= max, { message: messages.range(label, 0, max) });
}

/** Predicado puro: ¿es un monto monetario válido (finito y ≥ 0)? */
export function isValidAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

// =============================================================================
// 3. Enteros positivos y porcentajes (con límites)
// =============================================================================

/**
 * Schema de entero dentro de un rango cerrado `[min, max]`.
 * Rechaza decimales y no numéricos.
 */
export function integerInRange(label: string, min: number, max: number) {
  return z.coerce
    .number({ error: messages.onlyDigits(label) })
    .refine((n) => Number.isFinite(n), { message: messages.onlyDigits(label) })
    .refine((n) => Number.isInteger(n), { message: messages.integer(label) })
    .refine((n) => n >= min && n <= max, {
      message: messages.range(label, min, max),
    });
}

/** Entero positivo `[1, max]` (ej. clases por mes, días de congelamiento). */
export function positiveInteger(label = 'El valor', max = 1000) {
  return integerInRange(label, 1, max);
}

/** Porcentaje acotado a `[0, 100]`. */
export function percentage(label = 'El porcentaje') {
  return z.coerce
    .number({ error: messages.onlyDigits(label) })
    .refine((n) => Number.isFinite(n), { message: messages.onlyDigits(label) })
    .refine((n) => n >= 0 && n <= 100, { message: messages.range(label, 0, 100) });
}

// =============================================================================
// 4. Fechas (helpers UTC + integridad cronológica + cálculo de vencimiento)
// =============================================================================

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/** ¿La cadena es una fecha ISO `YYYY-MM-DD` válida (en UTC)? */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = parseIsoDateUTC(value);
  if (Number.isNaN(d.getTime())) return false;
  // Round-trip: descarta fechas imposibles normalizadas (ej. 2024-02-31).
  return toIsoDateUTC(d) === value.slice(0, 10);
}

/** Parsea un ISO `YYYY-MM-DD` a un Date en UTC (medianoche). */
export function parseIsoDateUTC(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Formatea un Date a ISO `YYYY-MM-DD` con componentes UTC. */
export function toIsoDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Suma un mes calendario con clamping del día al último día del mes destino
 * (31 ene + 1 mes → 28/29 feb). Trabaja en UTC.
 */
export function addOneMonthUTC(date: Date): Date {
  const day = date.getUTCDate();
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** Suma `n` meses calendario aplicando clamping en cada paso. */
export function addMonthsUTC(date: Date, months: number): Date {
  let result = date;
  for (let i = 0; i < months; i += 1) {
    result = addOneMonthUTC(result);
  }
  return result;
}

/** Schema de fecha ISO válida. */
export function isoDateSchema(label = 'La fecha') {
  return z
    .string({ error: messages.required(label) })
    .trim()
    .min(1, { message: messages.required(label) })
    .refine(isValidIsoDate, { message: messages.invalidDate(label) });
}

/** ¿`end` es igual o posterior a `start`? (ambos ISO). */
export function isChronological(start: string, end: string): boolean {
  return parseIsoDateUTC(end).getTime() >= parseIsoDateUTC(start).getTime();
}

/**
 * Schema de rango de fechas con integridad cronológica: `end >= start`.
 * Acepta cualquier objeto con las dos claves indicadas. Se valida como
 * `Record<string, string>` para mantener la firma genérica de las claves sin
 * fricciones con la inferencia de Zod v4.
 */
export function dateRangeSchema(
  startKey: string,
  endKey: string,
  startLabel = 'La fecha inicial',
  endLabel = 'La fecha final',
): z.ZodType<Record<string, string>> {
  const shape: Record<string, z.ZodTypeAny> = {
    [startKey]: isoDateSchema(startLabel),
    [endKey]: isoDateSchema(endLabel),
  };

  return z
    .object(shape)
    .refine(
      (data) => isChronological(data[startKey] as string, data[endKey] as string),
      { message: messages.chronological(startLabel, endLabel), path: [endKey] },
    ) as unknown as z.ZodType<Record<string, string>>;
}

/**
 * Calcula automáticamente la nueva fecha de vencimiento tras un pago
 * (STEERING_FORMS §4). Lógica canónica reutilizada por el Back (PaymentService).
 *
 * - `paid` y plan NO `single` → `max(oldEnd, paymentDate) + 1 mes`.
 * - `upgrade` / `credit` o plan `single` → sin cambio (retorna `oldEndDate`).
 *
 * Todas las fechas en ISO `YYYY-MM-DD` (UTC).
 */
export function computeSubscriptionEndDate(
  oldEndDate: string,
  paymentDate: string,
  status: 'paid' | 'upgrade' | 'credit',
  plan?: Pick<MembershipPlan, 'single'>,
): string {
  const isSingle = plan?.single === true;

  if (status !== 'paid' || isSingle) {
    return oldEndDate;
  }

  const oldEnd = parseIsoDateUTC(oldEndDate);
  const payDate = parseIsoDateUTC(paymentDate);
  const base = oldEnd.getTime() >= payDate.getTime() ? oldEnd : payDate;
  return toIsoDateUTC(addOneMonthUTC(base));
}

// =============================================================================
// 5. Selects (validación contra el array de datos de origen)
// =============================================================================

/**
 * Predicado puro: ¿el valor pertenece al catálogo de origen?
 *
 * @param value   Valor seleccionado.
 * @param source  Array de datos autorizados.
 * @param getKey  Extractor de la clave comparable de cada item.
 */
export function isInSource<T>(
  value: string,
  source: readonly T[],
  getKey: (item: T) => string,
): boolean {
  return source.some((item) => getKey(item) === value);
}

/**
 * Schema de select validado contra un array de datos de origen. Rechaza
 * valores vacíos (obligatorio) y cualquier valor fuera del catálogo actual
 * (ej. un plan eliminado). Bloquea entrada manual de valores inexistentes.
 *
 * @param source  Array de datos autorizados (ej. `costs.memberships`).
 * @param getKey  Extractor de la clave (por defecto, item con `.id`).
 * @param label   Etiqueta para los mensajes.
 */
export function selectFromSource<T>(
  source: readonly T[],
  getKey: (item: T) => string = (item) => (item as { id: string }).id,
  label = 'La opción',
) {
  const keys = source.map(getKey);
  return z
    .string({ error: messages.required(label) })
    .trim()
    .min(1, { message: messages.required(label) })
    .refine((v) => keys.includes(v), { message: messages.notInCatalog(label) });
}

// =============================================================================
// Schemas de ejemplo compuestos (para reutilizar en formularios)
// =============================================================================

/** Schema base de un pago (montos no negativos + fecha válida). */
export function paymentBaseSchema(label = 'El monto') {
  return z.object({
    date: isoDateSchema('La fecha de pago'),
    amount: nonNegativeAmount(label),
    discount: nonNegativeAmount('El descuento'),
  });
}

/** Schema base de un plan de membresía. */
export function planBaseSchema() {
  return z.object({
    name: z
      .string({ error: messages.required('El nombre') })
      .trim()
      .min(1, { message: messages.required('El nombre') }),
    price: nonNegativeAmount('El precio'),
    classesPerMonth: positiveInteger('Las clases por mes').optional(),
    single: z.boolean().optional(),
  });
}
