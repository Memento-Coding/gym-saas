/**
 * PlanEditor — Editor de planes de membresía.
 *
 * Muestra planes grupales y personalizados en filas editables.
 * Permite crear planes, editarlos y eliminar los que no estén en uso.
 *
 * Validación: usa el catálogo `src/utils/validation.ts` (STEERING_FORMS §1, §3).
 * Este editor alimenta el catálogo de membresías que consume PaymentForm, por lo
 * que la integridad de los datos aquí es crítica:
 *  - El precio no puede ser negativo ni no numérico (copAmount).
 *  - El nombre del plan es obligatorio y único: el formulario de estudiantes
 *    identifica el plan por su nombre.
 *  - El guardado se bloquea mientras exista cualquier error de validación.
 *
 * Requirements: 4.4, 15.1
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { countStudentsOnPlan } from '@/services/MembershipService';
import type { CostsConfig, MembershipPlan } from '@/types/membership';
import type { Student } from '@/types/student';
import { copAmount, messages, positiveInteger } from '@/utils/validation';

interface PlanEditorProps {
  costs: CostsConfig | null;
  onSave: (config: CostsConfig) => Promise<void>;
  /** Sin este dato no se sabe qué planes están en uso y no se permite eliminar. */
  students?: Pick<Student, 'planId' | 'planName' | 'status'>[];
}

type PlanGroup = 'memberships' | 'personalized';

const EMPTY_NEW_PLAN = { name: '', price: '', single: false, classes: '' };

/** Mismas columnas en la cabecera, las filas y el formulario de plan nuevo. */
const COLUMNS =
  'grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_8.5rem_7rem_2.25rem] sm:items-start';

const GROUP_COPY: Record<PlanGroup, { title: string; description: string; add: string; empty: string }> = {
  memberships: {
    title: 'Planes grupales',
    description: 'Clases compartidas con otros estudiantes.',
    add: 'Agregar plan grupal',
    empty: 'Todavía no tienes planes grupales.',
  },
  personalized: {
    title: 'Entrenamiento personalizado',
    description: 'Sesiones individuales con un entrenador.',
    add: 'Agregar plan personalizado',
    empty: 'Todavía no tienes planes personalizados.',
  },
};

/** Errores de validación por plan (indexados por campo). */
interface PlanErrors {
  name?: string;
  price?: string;
  classes?: string;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-CO')}`;
}

/** Qué significa el plan para el gimnasio, en una frase. */
function describePlan(plan: MembershipPlan): string | null {
  if (!Number.isInteger(plan.price) || plan.price < 0) return null;
  const price = formatCurrency(plan.price);
  if (plan.single) return `${price} por clase. El pago no cambia la fecha de vencimiento.`;
  const classes = plan.classesPerMonth ? ` Incluye ${plan.classesPerMonth} clases.` : '';
  return `${price} al mes. Cada pago suma un mes al vencimiento.${classes}`;
}

// -----------------------------------------------------------------------------
// Validación (catálogo reutilizable)
// -----------------------------------------------------------------------------

/** Schema de precio reutilizado en cada fila. */
const priceSchema = copAmount('El precio');

/**
 * Valida un plan individual contra el estándar. `siblings` son todos los planes
 * del gimnasio, para verificar unicidad de nombre.
 */
function validatePlan(
  plan: MembershipPlan,
  siblings: MembershipPlan[],
): PlanErrors {
  const errors: PlanErrors = {};

  // Nombre obligatorio (STEERING_FORMS §3).
  const name = plan.name.trim();
  if (name === '') {
    errors.name = messages.required('El nombre del plan');
  } else if (name.length > 100) {
    errors.name = messages.tooLong('El nombre del plan', 100);
  } else if (
    // Unicidad de nombre (case-insensitive), excluyéndose.
    siblings.some(
      (s) => s.id !== plan.id && s.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    errors.name = 'Ya existe un plan con ese nombre.';
  }

  // Precio no negativo ni no numérico (STEERING_FORMS §1).
  const priceResult = priceSchema.safeParse(plan.price);
  if (!priceResult.success) {
    errors.price = priceResult.error.issues[0]?.message ?? messages.negative('El precio');
  }

  if (plan.classesPerMonth !== undefined) {
    const classes = positiveInteger('Las clases al mes', 100).safeParse(plan.classesPerMonth);
    if (!classes.success) errors.classes = classes.error.issues[0]?.message;
  }

  return errors;
}

function hasErrors(errors: PlanErrors): boolean {
  return Boolean(errors.name || errors.price || errors.classes);
}

// -----------------------------------------------------------------------------
// Controles compartidos
// -----------------------------------------------------------------------------

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1 text-xs font-medium text-destructive">{message}</p>
  ) : null;
}

function ChargeSelect({
  single,
  label,
  onChange,
}: {
  single: boolean;
  label: string;
  onChange: (single: boolean) => void;
}) {
  return (
    <Select value={single ? 'class' : 'monthly'} onValueChange={(v) => onChange(v === 'class')}>
      <SelectTrigger className="w-full text-sm" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="monthly">Cada mes</SelectItem>
        <SelectItem value="class">Por clase</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PriceInput({
  value,
  label,
  invalid,
  onChange,
}: {
  value: string;
  label: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
        $
      </span>
      <Input
        type="text"
        inputMode="numeric"
        placeholder="Precio"
        aria-label={label}
        aria-invalid={invalid}
        className={cn('pl-6 text-sm', invalid && 'border-destructive')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ClassesInput({
  value,
  label,
  disabled,
  onChange,
}: {
  value: string;
  label: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={disabled ? 'No aplica' : 'Sin límite'}
      aria-label={label}
      className="text-sm"
      disabled={disabled}
      value={value}
      onChange={(e) => {
        if (/^\d*$/.test(e.target.value)) onChange(e.target.value);
      }}
    />
  );
}

// -----------------------------------------------------------------------------
// Fila de plan
// -----------------------------------------------------------------------------

function PlanRow({
  plan,
  errors,
  onChange,
  onDelete,
  deleteBlocked,
}: {
  plan: MembershipPlan;
  errors: PlanErrors;
  onChange: (updated: MembershipPlan) => void;
  onDelete: () => void;
  deleteBlocked: string | null;
}) {
  const description = describePlan(plan);
  return (
    <div className="py-3">
      <div className={COLUMNS}>
        <div className="col-span-2 sm:col-span-1">
          <Input
            value={plan.name}
            onChange={(e) => onChange({ ...plan, name: e.target.value })}
            placeholder="Nombre del plan"
            aria-label={`Nombre del plan ${plan.id}`}
            aria-invalid={Boolean(errors.name)}
            className={cn('text-sm', errors.name && 'border-destructive')}
          />
          <FieldError message={errors.name} />
        </div>
        <div>
          <PriceInput
            value={Number.isNaN(plan.price) ? '' : String(plan.price)}
            label={`Precio del plan ${plan.id}`}
            invalid={Boolean(errors.price)}
            onChange={(raw) => onChange({ ...plan, price: parsePrice(raw) })}
          />
          <FieldError message={errors.price} />
        </div>
        <ChargeSelect
          single={plan.single === true}
          label={`Cómo se cobra el plan ${plan.id}`}
          onChange={(single) =>
            onChange({
              ...plan,
              single: single || undefined,
              classesPerMonth: single ? undefined : plan.classesPerMonth,
            })
          }
        />
        <div>
          <ClassesInput
            value={plan.classesPerMonth === undefined ? '' : String(plan.classesPerMonth)}
            label={`Clases al mes del plan ${plan.id}`}
            disabled={plan.single === true}
            onChange={(raw) =>
              onChange({ ...plan, classesPerMonth: raw === '' ? undefined : Number(raw) })
            }
          />
          <FieldError message={errors.classes} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Eliminar plan ${plan.name}`}
          title={deleteBlocked ?? undefined}
          disabled={deleteBlocked !== null}
          onClick={onDelete}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
      {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      {deleteBlocked && <p className="mt-0.5 text-xs text-muted-foreground">{deleteBlocked}</p>}
    </div>
  );
}

/**
 * Convierte el texto del input de precio a número, preservando el valor crudo
 * cuando no es numérico para que el schema pueda reportar el error (en lugar de
 * silenciarlo a 0). Cadena vacía → 0.
 */
function parsePrice(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  const n = Number(trimmed);
  return Number.isNaN(n) ? Number.NaN : n;
}

// -----------------------------------------------------------------------------
// Editor
// -----------------------------------------------------------------------------

export function PlanEditor({ costs, onSave, students }: PlanEditorProps) {
  const [memberships, setMemberships] = useState<MembershipPlan[]>(costs?.memberships ?? []);
  const [personalized, setPersonalized] = useState<MembershipPlan[]>(costs?.personalized ?? []);
  const [saved, setSaved] = useState<CostsConfig>({
    memberships: costs?.memberships ?? [],
    personalized: costs?.personalized ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [addingTo, setAddingTo] = useState<PlanGroup | null>(null);
  const [newPlan, setNewPlan] = useState(EMPTY_NEW_PLAN);
  const [newPlanError, setNewPlanError] = useState('');

  const allPlans = useMemo(
    () => [...memberships, ...personalized],
    [memberships, personalized],
  );

  const errorsById = useMemo(
    () => new Map(allPlans.map((p) => [p.id, validatePlan(p, allPlans)])),
    [allPlans],
  );
  const isValid = ![...errorsById.values()].some(hasErrors);
  const isDirty = JSON.stringify({ memberships, personalized }) !== JSON.stringify(saved);

  const closeAddForm = () => {
    setAddingTo(null);
    setNewPlan(EMPTY_NEW_PLAN);
    setNewPlanError('');
  };

  const setGroup = (group: PlanGroup) =>
    group === 'memberships' ? setMemberships : setPersonalized;

  const handleAddPlan = (group: PlanGroup) => {
    const price = copAmount('El precio').safeParse(newPlan.price);
    const plan: MembershipPlan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: newPlan.name.trim(),
      price: Number(price.data),
      ...(newPlan.single && { single: true }),
      ...(newPlan.classes && !newPlan.single && { classesPerMonth: Number(newPlan.classes) }),
    };
    const errors = validatePlan(plan, allPlans);
    const problem =
      errors.name ?? (price.success ? errors.classes : price.error.issues[0]?.message);
    if (problem) {
      setNewPlanError(problem);
      return;
    }
    setGroup(group)((plans) => [...plans, plan]);
    closeAddForm();
  };

  /** Motivo por el que un plan no se puede eliminar, o null si se puede. */
  const deleteBlockedReason = (plan: MembershipPlan): string | null => {
    if (allPlans.length <= 1) return 'Debe existir al menos un plan.';
    if (!students) return 'Cargando los estudiantes que usan este plan…';
    // Con el nombre guardado: renombrar sin guardar no debe esconder a sus estudiantes.
    const original = [...saved.memberships, ...saved.personalized].find((p) => p.id === plan.id);
    const count = countStudentsOnPlan(original ?? plan, students);
    return count > 0
      ? `En uso por ${count} ${count === 1 ? 'estudiante' : 'estudiantes'}: reasígnalos antes de eliminarlo.`
      : null;
  };

  const handleDiscard = () => {
    setMemberships(saved.memberships);
    setPersonalized(saved.personalized);
    closeAddForm();
  };

  const handleSave = async () => {
    // Bloqueo de guardado si hay errores (STEERING_FORMS §3).
    if (!isValid) {
      toast.error('Corrige los errores antes de guardar.');
      return;
    }
    setSaving(true);
    try {
      const normalize = (plans: MembershipPlan[]) =>
        plans.map((p) => ({ ...p, name: p.name.trim(), price: Number(p.price) }));
      const next = {
        memberships: normalize(memberships),
        personalized: normalize(personalized),
      };
      await onSave(next);
      setMemberships(next.memberships);
      setPersonalized(next.personalized);
      setSaved(next);
      toast.success('Planes guardados.');
    } catch {
      toast.error('No se pudieron guardar los planes. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const renderGroup = (group: PlanGroup, plans: MembershipPlan[]) => {
    const copy = GROUP_COPY[group];
    const adding = addingTo === group;
    return (
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{copy.title}</h3>
            <p className="text-sm text-muted-foreground">{copy.description}</p>
          </div>
          {!adding && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                closeAddForm();
                setAddingTo(group);
              }}
            >
              <Plus className="size-4" />
              {copy.add}
            </Button>
          )}
        </div>

        {plans.length > 0 && (
          <div className={cn(COLUMNS, 'hidden border-b pb-1.5 text-xs text-muted-foreground sm:grid')}>
            <span>Nombre</span>
            <span>Precio</span>
            <span>Cómo se cobra</span>
            <span>Clases al mes</span>
          </div>
        )}

        {plans.length === 0 && !adding && (
          <p className="py-3 text-sm text-muted-foreground">{copy.empty}</p>
        )}

        <div className="divide-y">
          {plans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              errors={errorsById.get(plan.id) ?? {}}
              onChange={(updated) =>
                setGroup(group)((list) => list.map((p) => (p.id === plan.id ? updated : p)))
              }
              onDelete={() => setGroup(group)((list) => list.filter((p) => p.id !== plan.id))}
              deleteBlocked={deleteBlockedReason(plan)}
            />
          ))}
        </div>

        {adding && (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
            <div className={COLUMNS}>
              <Input
                placeholder="Nombre del plan"
                aria-label="Nombre del nuevo plan"
                maxLength={100}
                autoFocus
                className="col-span-2 text-sm sm:col-span-1"
                value={newPlan.name}
                onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
              />
              <PriceInput
                value={newPlan.price}
                label="Precio del nuevo plan"
                onChange={(price) => setNewPlan({ ...newPlan, price })}
              />
              <ChargeSelect
                single={newPlan.single}
                label="Cómo se cobra el nuevo plan"
                onChange={(single) =>
                  setNewPlan({ ...newPlan, single, classes: single ? '' : newPlan.classes })
                }
              />
              <ClassesInput
                value={newPlan.classes}
                label="Clases al mes del nuevo plan"
                disabled={newPlan.single}
                onChange={(classes) => setNewPlan({ ...newPlan, classes })}
              />
            </div>
            {newPlanError && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {newPlanError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => handleAddPlan(group)}>
                Agregar
              </Button>
              <Button variant="ghost" size="sm" onClick={closeAddForm}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Planes</CardTitle>
          <CardDescription>
            Lo que vendes y cuánto cuesta. Estos planes aparecen al registrar un estudiante y al
            cobrarle.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          {renderGroup('memberships', memberships)}
          {renderGroup('personalized', personalized)}
        </CardContent>
      </Card>

      {isDirty && (
        <div className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-md">
          <p className="text-sm font-medium">
            {isValid ? 'Tienes cambios sin guardar.' : 'Corrige los errores para poder guardar.'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={saving}>
              Descartar cambios
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !isValid}>
              {saving ? 'Guardando...' : 'Guardar planes'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
