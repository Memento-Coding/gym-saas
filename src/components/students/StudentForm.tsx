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

import { Fragment, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { DocumentTypeCode, Student } from '@/types/student';
import type { FormFieldConfig } from '@/types/settings';
import type { CostsConfig, MembershipPlan } from '@/types/membership';
import type { StorageService } from '@/services/storage/StorageService';
import {
  DOCUMENT_TYPES,
  ageFromBirthDate,
  birthDateSchema,
  copAmount,
  documentFormatError,
  emailSchema,
  getDocumentType,
  isDocumentUnique,
  isValidIsoDate,
  isoDateSchema,
  messages,
  nonNegativeAmount,
  personNameSchema,
  phoneSchema,
  textSchema,
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
  /** Planes del gimnasio: alimentan el campo Plan. */
  plans?: CostsConfig;
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

/** Campos que contienen nombres de persona. */
const PERSON_NAME_FIELDS = new Set(['firstName', 'lastName', 'emergencyName']);

const DOCUMENT_TYPE_CODES = DOCUMENT_TYPES.map((t) => t.value) as [
  DocumentTypeCode,
  ...DocumentTypeCode[],
];

/** Un acudiente siempre es adulto: no aplican TI ni RC. */
const GUARDIAN_DOCUMENT_TYPES = DOCUMENT_TYPES.filter((t) => t.forAdults);

function findPlan(plans: CostsConfig | undefined, matches: (p: MembershipPlan) => boolean) {
  const group = plans?.memberships.find(matches);
  if (group) return { plan: group, category: 'mensualidad' as const };
  const personalized = plans?.personalized.find(matches);
  return personalized ? { plan: personalized, category: 'personalizada' as const } : null;
}

/** Valor tipado del formulario: mapa flexible de nombre de campo a valor. */
type FormValues = Record<string, unknown>;

/**
 * Construye un schema Zod dinámico a partir de la configuración de campos.
 * Los campos `required` producen mensajes de error cuando están vacíos.
 * El guardián se valida condicionalmente según isMinor mediante superRefine.
 */
function buildSchema(fields: FormFieldConfig[], initial: FormValues): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {
    // isMinor siempre presente para la lógica condicional (Req 3.2).
    isMinor: z.boolean().default(false),
    documentType: z.enum(DOCUMENT_TYPE_CODES).default('CC'),
    guardianDocumentType: z.enum(DOCUMENT_TYPE_CODES).default('CC'),
    // El formato del acudiente solo aplica a menores: se valida en el superRefine.
    guardianName: z.string().trim().optional(),
    guardianDocument: z.string().trim().toUpperCase().optional(),
  };

  for (const field of fields) {
    // El guardián se maneja aparte con validación condicional.
    if ((GUARDIAN_FIELDS as readonly string[]).includes(field.name)) {
      continue;
    }

    let validator: z.ZodTypeAny;

    // El formato depende del tipo elegido: se valida en el superRefine.
    if (field.name === 'documentId') {
      shape[field.name] = z
        .string({ error: messages.required(field.label) })
        .trim()
        .toUpperCase()
        .min(1, { message: messages.required(field.label) });
      continue;
    }

    if (PERSON_NAME_FIELDS.has(field.name)) {
      shape[field.name] = personNameSchema(field.label, field.required);
      continue;
    }

    if (field.name === 'monthlyFee') {
      shape[field.name] = copAmount(field.label, field.required);
      continue;
    }

    if (field.name === 'dateOfBirth') {
      shape[field.name] = birthDateSchema(field.label, field.required);
      continue;
    }

    // Teléfono colombiano, detectado por tipo 'tel'.
    if (field.type === 'tel') {
      shape[field.name] = phoneSchema(field.label, field.required);
      continue;
    }

    // Email: formato válido, detectado por tipo 'email'.
    if (field.type === 'email') {
      shape[field.name] = emailSchema(field.label, field.required);
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
      case 'select': {
        // Catálogo vigente + valor histórico, para no bloquear la edición de
        // un estudiante cuyo plan ya no está en las opciones.
        const allowed = [...(field.options ?? []), initial[field.name]];
        validator = (textSchema(field.label, field.required) as z.ZodTypeAny).refine(
          (v) => !v || !field.options?.length || allowed.includes(v),
          { message: messages.notInCatalog(field.label) },
        );
        break;
      }
      case 'text':
      default: {
        validator = textSchema(field.label, field.required);
        break;
      }
    }

    shape[field.name] = validator;
  }

  return z
    .object(shape)
    .passthrough()
    .superRefine((data, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });
      const isMinor = data.isMinor === true;
      const type = getDocumentType(data.documentType as DocumentTypeCode);

      const documentId = data.documentId;
      if (typeof documentId === 'string' && documentId) {
        const error = documentFormatError(documentId, type.value);
        if (error) issue('documentId', error);
      }

      if (isMinor ? !type.forMinors : !type.forAdults) {
        issue(
          'documentType',
          `${type.label} no corresponde a ${isMinor ? 'un menor' : 'un mayor'} de edad.`,
        );
      }

      const birthDate = data.dateOfBirth;
      if (typeof birthDate === 'string' && isValidIsoDate(birthDate)) {
        const isAdultByAge = ageFromBirthDate(birthDate) >= 18;
        if (isAdultByAge === isMinor) {
          issue(
            'dateOfBirth',
            isMinor
              ? 'Según esta fecha es mayor de edad: desmarca "Es menor de edad".'
              : 'Según esta fecha es menor de edad: marca "Es menor de edad".',
          );
        }
      }

      // Req 3.2: si es menor, el guardián es obligatorio.
      if (!isMinor) return;
      for (const key of GUARDIAN_FIELDS) {
        const value = data[key];
        if (typeof value !== 'string' || value.trim() === '') {
          issue(
            key,
            key === 'guardianName'
              ? 'El nombre del acudiente es obligatorio para menores.'
              : 'El documento del acudiente es obligatorio para menores.',
          );
        }
      }

      if (data.guardianName) {
        const name = personNameSchema('El nombre del acudiente').safeParse(data.guardianName);
        if (!name.success) issue('guardianName', name.error.issues[0].message);
      }

      if (typeof data.guardianDocument === 'string' && data.guardianDocument) {
        const error = documentFormatError(
          data.guardianDocument,
          data.guardianDocumentType as DocumentTypeCode,
          'El documento del acudiente',
        );
        if (error) issue('guardianDocument', error);
        else if (data.guardianDocument === documentId) {
          issue('guardianDocument', 'El acudiente no puede tener el mismo documento del menor.');
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
    documentType: defaults?.documentType ?? (defaults?.isMinor ? 'TI' : 'CC'),
    guardianDocumentType: defaults?.guardianDocumentType ?? 'CC',
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
  plans?: CostsConfig,
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

  result.documentType = values.documentType;

  // El nombre elegido se enlaza al plan real; sin mensualidad, aplica su precio.
  const chosen = findPlan(plans, (p) => p.name === values.planName);
  if (chosen) {
    result.planId = chosen.plan.id;
    result.planCategory = chosen.category;
    result.monthlyFee ??= chosen.plan.price;
  }

  // isMinor y guardián (Req 3.2).
  result.isMinor = values.isMinor === true;
  if (result.isMinor) {
    result.guardianName = (values.guardianName as string) ?? '';
    result.guardianDocument = (values.guardianDocument as string) ?? '';
    result.guardianDocumentType = values.guardianDocumentType;
  } else {
    // Al no ser menor, no imponemos datos de guardián.
    result.guardianName = '';
    result.guardianDocument = '';
    result.guardianDocumentType = undefined;
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
  fields: configuredFields,
  plans,
  defaultValues: studentValues,
  onSubmit,
  isLoading = false,
  onCancel,
  storage,
}: StudentFormProps) {
  // Si el plan se renombró en Ajustes, el planId da el nombre vigente.
  const defaultValues = useMemo(() => {
    const planId = studentValues?.planId;
    const current = planId ? findPlan(plans, (p) => p.id === planId) : null;
    return current ? { ...studentValues, planName: current.plan.name } : studentValues;
  }, [studentValues, plans]);

  const fields = useMemo(() => {
    if (!plans) return configuredFields;
    const names = [...plans.memberships, ...plans.personalized].map((p) => p.name);
    // Un plan ya retirado sigue visible para quien lo tiene asignado.
    const current = defaultValues?.planName;
    if (current && !names.includes(current)) names.push(current);
    return configuredFields.map((f) => (f.name === 'planName' ? { ...f, options: names } : f));
  }, [configuredFields, plans, defaultValues?.planName]);

  const initialValues = useMemo(
    () => buildDefaultValues(fields, defaultValues),
    [fields, defaultValues],
  );
  const schema = useMemo(() => buildSchema(fields, initialValues), [fields, initialValues]);

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
  const documentType = form.watch('documentType') as DocumentTypeCode;
  const guardianDocumentType = form.watch('guardianDocumentType') as DocumentTypeCode;

  // Al cambiar la mayoría de edad, propone un tipo de documento coherente.
  const handleMinorChange = (minor: boolean) => {
    const current = getDocumentType(form.getValues('documentType') as DocumentTypeCode);
    if (minor ? !current.forMinors : !current.forAdults) {
      form.setValue('documentType', minor ? 'TI' : 'CC');
      form.clearErrors(['documentType', 'documentId']);
    }
  };

  // Elegir un plan propone su precio como mensualidad (sigue siendo editable).
  const handleSelect = (name: string, value: string) => {
    const chosen = name === 'planName' ? findPlan(plans, (p) => p.name === value) : null;
    if (chosen) {
      form.setValue('monthlyFee', String(chosen.plan.price));
      form.clearErrors('monthlyFee');
    }
  };

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
          values.documentType as DocumentTypeCode,
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

    const data = assembleStudentData(values, fields, defaultValues, plans);
    await onSubmit(data);
  });

  const submitDisabled = isLoading || isCheckingDocument;

  return (
    <Form {...form}>
      {/* noValidate: los errores los reporta Zod junto al campo, no la burbuja del navegador. */}
      <form onSubmit={handleSubmit} noValidate className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields
            // El guardián se renderiza en su bloque condicional, no aquí.
            .filter(
              (f) => !(GUARDIAN_FIELDS as readonly string[]).includes(f.name),
            )
            .map((field) => (
              <Fragment key={field.id}>
                {field.name === 'documentId' && (
                  <DocumentTypeField
                    name="documentType"
                    label="Tipo de documento"
                    options={DOCUMENT_TYPES}
                    control={form.control}
                    onSelect={() => form.clearErrors(['documentId', 'documentType'])}
                  />
                )}
                <DynamicField
                  field={field}
                  control={form.control}
                  documentType={documentType}
                  onSelect={handleSelect}
                />
              </Fragment>
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
                  onCheckedChange={(checked) => {
                    field.onChange(checked === true);
                    handleMinorChange(checked === true);
                  }}
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
            <DocumentTypeField
              name="guardianDocumentType"
              label="Tipo doc. acudiente"
              options={GUARDIAN_DOCUMENT_TYPES}
              control={form.control}
              onSelect={() => form.clearErrors('guardianDocument')}
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
                      inputMode={guardianDocumentType === 'PA' ? 'text' : 'numeric'}
                      placeholder={getDocumentType(guardianDocumentType).hint}
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

type FormControlHandle = ReturnType<typeof useForm<FormValues>>['control'];

/** Selector de tipo de documento, común al estudiante y al acudiente. */
function DocumentTypeField({
  name,
  label,
  options,
  control,
  onSelect,
}: {
  name: string;
  label: string;
  options: typeof DOCUMENT_TYPES;
  control: FormControlHandle;
  onSelect: () => void;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            <span className="ml-0.5 text-destructive">*</span>
          </FormLabel>
          <Select
            value={field.value as string}
            onValueChange={(value) => {
              field.onChange(value);
              onSelect();
            }}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.value} — {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * Renderiza un único campo dinámico según su tipo (Req 3.9).
 */
function DynamicField({
  field,
  control,
  documentType,
  onSelect,
}: {
  field: FormFieldConfig;
  control: FormControlHandle;
  documentType: DocumentTypeCode;
  onSelect: (name: string, value: string) => void;
}) {
  const isDocument = field.name === 'documentId';
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
          {field.type === 'select' ? (
            <Select
              value={(rhf.value as string) ?? ''}
              onValueChange={(value) => {
                rhf.onChange(value);
                onSelect(field.name, value);
              }}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Selecciona ${field.label}`} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {(field.options ?? []).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <FormControl>
              <Input
                type={
                  // 'date' → type="date" nativo.
                  // 'email' → type="email" (keyboard email en móvil + validación browser).
                  // 'tel' → type="tel" (keyboard numérico en móvil).
                  // 'number', 'text' → type="text" + inputMode numérico cuando aplica:
                  //   la validación la hace Zod con mensajes claros, no el bloqueo
                  //   silencioso de type="number" que además rompe en jsdom.
                  field.type === 'date'
                    ? 'date'
                    : field.type === 'email'
                      ? 'email'
                      : field.type === 'tel'
                        ? 'tel'
                        : 'text'
                }
                inputMode={
                  (isDocument && documentType !== 'PA') || field.type === 'number'
                    ? 'numeric'
                    : field.type === 'tel'
                      ? 'tel'
                      : undefined
                }
                placeholder={
                  isDocument
                    ? getDocumentType(documentType).hint
                    : field.type === 'tel'
                      ? '3001234567'
                      : undefined
                }
                autoComplete={
                  field.type === 'email'
                    ? 'email'
                    : field.type === 'tel'
                      ? 'tel'
                      : undefined
                }
                value={(rhf.value as string | number | undefined) ?? ''}
                onChange={rhf.onChange}
                onBlur={rhf.onBlur}
                name={rhf.name}
                ref={rhf.ref}
              />
            </FormControl>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default StudentForm;
