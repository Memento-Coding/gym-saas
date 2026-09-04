/**
 * StudentForm — Renderizador dinámico de formulario de estudiantes.
 *
 * Genera inputs a partir de una configuración de campos flexible (FormFieldConfig[])
 * proveniente del módulo de ajustes, aplicando validaciones dinámicas, lógica
 * condicional para menores de edad y preservación de datos históricos huérfanos.
 *
 * Reqs cubiertos:
 *  - 3.9  Renderizado dinámico de campos (text | number | date | select).
 *  - 3.10 Validaciones dinámicas (campos required bloquean el envío).
 *  - 3.2  Lógica condicional: isMinor exige guardianName y guardianDocument.
 *  - 3.11 Preservación de customFields históricos al hacer submit.
 */

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { Student } from '@/types/student';
import type { FormFieldConfig } from '@/types/settings';
import type { StorageService } from '@/services/storage/StorageService';
import {
  documentSchema,
  nonNegativeAmount,
  isoDateSchema,
  isDocumentUnique,
} from '@/utils/validation';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Campos de Student que el guardián condicional controla. */
const GUARDIAN_FIELDS = ['guardianName', 'guardianDocument'] as const;

export interface StudentFormProps {
  /** Configuración dinámica de campos extraída del módulo de ajustes. */
  fields: FormFieldConfig[];
  /** Datos históricos del estudiante en modo edición. */
  defaultValues?: Partial<Student>;
  /** Callback de envío. Recibe el subconjunto de datos del estudiante. */
  onSubmit: (data: Partial<Student>) => Promise<void>;
  /** Indica que hay una operación en curso (deshabilita acciones). */
  isLoading?: boolean;
  /** Callback opcional para cancelar la edición. */
  onCancel?: () => void;
  /**
   * StorageService inyectable para la validación de unicidad del documento.
   * Por defecto usa el singleton (getStorageService). Útil para tests.
   */
  storage?: StorageService;
}

/**
 * Claves de Student que se escriben en el nivel raíz del objeto.
 * Cualquier campo dinámico cuyo `name` no esté aquí se persiste en customFields.
 */
const ROOT_STUDENT_KEYS = new Set<string>([
  'photo',
  'firstName',
  'lastName',
  'documentId',
  'isMinor',
  'guardianName',
  'guardianDocument',
  'phone',
  'email',
  'emergencyName',
  'emergencyPhone',
  'emergencyRelation',
  'dateOfBirth',
  'bloodType',
  'subscriptionEndDate',
  'monthlyFee',
  'planName',
  'planId',
  'medicalNotes',
  'beltRank',
]);

/** Valor tipado del formulario: mapa flexible de nombre de campo a valor. */
type FormValues = Record<string, unknown>;

/**
 * Construye un schema Zod dinámico a partir de la configuración de campos.
 * Los campos `required` producen mensajes de error cuando están vacíos.
 * El guardián se valida condicionalmente según isMinor mediante superRefine.
 */
function buildSchema(fields: FormFieldConfig[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {
    // isMinor siempre presente para la lógica condicional (Req 3.2).
    isMinor: z.boolean().default(false),
    guardianName: z.string().optional(),
    // Documento del acudiente: solo números (STEERING_FORMS §1), misma regla
    // que documentId. La validación condicional de obligatoriedad sigue en
    // el superRefine; aquí solo definimos el formato cuando haya valor.
    guardianDocument: z
      .union([z.literal(''), documentSchema('El documento del acudiente')])
      .optional(),
  };

  for (const field of fields) {
    // El guardián se maneja aparte con validación condicional.
    if ((GUARDIAN_FIELDS as readonly string[]).includes(field.name)) {
      continue;
    }

    let validator: z.ZodTypeAny;

    // Documento: solo números (STEERING_FORMS §1). Se detecta por `name`
    // porque en la config viene declarado como tipo 'text'.
    if (field.name === 'documentId') {
      validator = documentSchema(field.label);
      shape[field.name] = validator;
      continue;
    }

    switch (field.type) {
      case 'number': {
        // Monto/entero no negativo (STEERING_FORMS §1). Los inputs number
        // pueden llegar como string; nonNegativeAmount coerciona y valida.
        if (field.required) {
          validator = nonNegativeAmount(field.label);
        } else {
          // Opcional: permite vacío; si hay valor, debe ser no negativo.
          validator = z.union([z.literal(''), nonNegativeAmount(field.label)]);
        }
        break;
      }
      case 'date': {
        // Fecha ISO válida (STEERING_FORMS §4).
        if (field.required) {
          validator = isoDateSchema(field.label);
        } else {
          validator = z.union([z.literal(''), isoDateSchema(field.label)]);
        }
        break;
      }
      case 'select':
      case 'text':
      default: {
        validator = z.string();
        if (field.required) {
          validator = (validator as z.ZodString).min(1, {
            message: `${field.label} es obligatorio.`,
          });
        } else {
          validator = validator.optional();
        }
        break;
      }
    }

    shape[field.name] = validator;
  }

  return z
    .object(shape)
    .passthrough()
    .superRefine((data, ctx) => {
      // Req 3.2: si es menor, el guardián es obligatorio.
      if (data.isMinor === true) {
        for (const key of GUARDIAN_FIELDS) {
          const value = data[key];
          if (typeof value !== 'string' || value.trim() === '') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [key],
              message:
                key === 'guardianName'
                  ? 'El nombre del acudiente es obligatorio para menores.'
                  : 'El documento del acudiente es obligatorio para menores.',
            });
          }
        }
      }
    });
}

/**
 * Deriva los valores iniciales del formulario combinando defaultValues del
 * estudiante con sus customFields, para cada campo dinámico declarado.
 */
function buildDefaultValues(
  fields: FormFieldConfig[],
  defaults?: Partial<Student>,
): FormValues {
  const values: FormValues = {
    isMinor: defaults?.isMinor ?? false,
    guardianName: defaults?.guardianName ?? '',
    guardianDocument: defaults?.guardianDocument ?? '',
  };

  const custom = defaults?.customFields ?? {};

  for (const field of fields) {
    if ((GUARDIAN_FIELDS as readonly string[]).includes(field.name)) {
      continue;
    }

    if (ROOT_STUDENT_KEYS.has(field.name)) {
      const raw = (defaults as Record<string, unknown> | undefined)?.[field.name];
      values[field.name] = raw ?? (field.type === 'number' ? '' : '');
    } else {
      values[field.name] = custom[field.name] ?? '';
    }
  }

  return values;
}

/**
 * Ensambla el objeto Partial<Student> a partir de los valores del formulario.
 *
 * Req 3.11 (crítico): los customFields históricos que ya no aparecen en la
 * configuración de campos se preservan; los nuevos valores se mezclan encima
 * sin borrar la data huérfana.
 */
function assembleStudentData(
  values: FormValues,
  fields: FormFieldConfig[],
  defaults?: Partial<Student>,
): Partial<Student> {
  const result: Record<string, unknown> = {};

  // Merge de customFields: primero los históricos, luego los del formulario.
  const mergedCustom: Record<string, unknown> = { ...(defaults?.customFields ?? {}) };

  for (const field of fields) {
    if ((GUARDIAN_FIELDS as readonly string[]).includes(field.name)) {
      continue;
    }

    const raw = values[field.name];
    const value = normalizeValue(raw, field.type);

    if (ROOT_STUDENT_KEYS.has(field.name)) {
      result[field.name] = value;
    } else {
      mergedCustom[field.name] = value;
    }
  }

  // isMinor y guardián (Req 3.2).
  result.isMinor = values.isMinor === true;
  if (result.isMinor) {
    result.guardianName = (values.guardianName as string) ?? '';
    result.guardianDocument = (values.guardianDocument as string) ?? '';
  } else {
    // Al no ser menor, no imponemos datos de guardián.
    result.guardianName = '';
    result.guardianDocument = '';
  }

  if (Object.keys(mergedCustom).length > 0) {
    result.customFields = mergedCustom;
  }

  return result as Partial<Student>;
}

/** Convierte el valor crudo del input al tipo esperado por el modelo. */
function normalizeValue(raw: unknown, type: FormFieldConfig['type']): unknown {
  if (type === 'number') {
    if (raw === '' || raw === null || raw === undefined) return undefined;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isNaN(n) ? undefined : n;
  }
  return raw ?? '';
}

export function StudentForm({
  fields,
  defaultValues,
  onSubmit,
  isLoading = false,
  onCancel,
  storage,
}: StudentFormProps) {
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const initialValues = useMemo(
    () => buildDefaultValues(fields, defaultValues),
    [fields, defaultValues],
  );

  // El cast del resolver evita la fricción de inferencia entre Zod v4 y
  // react-hook-form, manteniendo FormValues como tipo del formulario.
  const resolver = useMemo(
    () =>
      zodResolver(
        schema as unknown as z.ZodType<FormValues, FormValues>,
      ) as unknown as Resolver<FormValues>,
    [schema],
  );

  const form = useForm<FormValues>({
    resolver,
    defaultValues: initialValues,
    mode: 'onSubmit',
  });

  const isMinor = form.watch('isMinor') === true;

  // Estado de la validación asíncrona de unicidad del documento (STEERING_FORMS
  // §5): mientras se consulta el StorageService (simulación backend), se
  // deshabilita el submit y se informa al usuario.
  const [isCheckingDocument, setIsCheckingDocument] = useState(false);

  const handleSubmit = form.handleSubmit(async (values) => {
    // Validación dual de unicidad del documento antes de persistir.
    // El schema ya garantizó que sea solo dígitos; aquí verificamos que no
    // exista otro estudiante con el mismo documento (excluyendo el propio en
    // modo edición).
    const documentId = String(values.documentId ?? '').trim();
    if (documentId) {
      setIsCheckingDocument(true);
      try {
        const unique = await isDocumentUnique(
          documentId,
          storage,
          defaultValues?.id,
        );
        if (!unique.success) {
          form.setError('documentId', {
            type: 'manual',
            message: unique.error,
          });
          return;
        }
      } catch {
        form.setError('documentId', {
          type: 'manual',
          message: 'No se pudo verificar el documento. Intenta de nuevo.',
        });
        return;
      } finally {
        setIsCheckingDocument(false);
      }
    }

    const data = assembleStudentData(values, fields, defaultValues);
    await onSubmit(data);
  });

  const submitDisabled = isLoading || isCheckingDocument;

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields
            // El guardián se renderiza en su bloque condicional, no aquí.
            .filter(
              (f) => !(GUARDIAN_FIELDS as readonly string[]).includes(f.name),
            )
            .map((field) => (
              <DynamicField key={field.id} field={field} control={form.control} />
            ))}
        </div>

        {/* Lógica condicional: menor de edad (Req 3.2). */}
        <FormField
          control={form.control}
          name="isMinor"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={isLoading}
                />
              </FormControl>
              <FormLabel className="!mt-0 cursor-pointer">
                Es menor de edad
              </FormLabel>
            </FormItem>
          )}
        />

        {isMinor && (
          <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="guardianName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Nombre del acudiente{' '}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      value={(field.value as string) ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="guardianDocument"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Documento del acudiente{' '}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={(field.value as string) ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={submitDisabled}>
            {isCheckingDocument
              ? 'Verificando documento...'
              : isLoading
                ? 'Guardando...'
                : 'Guardar'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * Renderiza un único campo dinámico según su tipo (Req 3.9).
 */
function DynamicField({
  field,
  control,
}: {
  field: FormFieldConfig;
  control: ReturnType<typeof useForm<FormValues>>['control'];
}) {
  return (
    <FormField
      control={control}
      name={field.name}
      render={({ field: rhf }) => (
        <FormItem>
          <FormLabel>
            {field.label}
            {field.required && <span className="ml-0.5 text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            {field.type === 'select' ? (
              <Select
                value={(rhf.value as string) ?? ''}
                onValueChange={rhf.onChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Selecciona ${field.label}`} />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={
                  // Documento y number usan text + inputMode numérico: la
                  // validación numérica la hace Zod (mensajes claros en vez
                  // del bloqueo silencioso de type="number").
                  field.type === 'date' ? 'date' : 'text'
                }
                inputMode={
                  field.name === 'documentId' || field.type === 'number'
                    ? 'numeric'
                    : undefined
                }
                value={(rhf.value as string | number | undefined) ?? ''}
                onChange={rhf.onChange}
                onBlur={rhf.onBlur}
                name={rhf.name}
                ref={rhf.ref}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default StudentForm;
