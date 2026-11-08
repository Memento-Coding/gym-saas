/**
 * PlanEditor — Editor de planes de membresía.
 *
 * Muestra planes grupales y personalizados en filas editables.
 * Permite crear planes, cambiar nombre y precio, y eliminar los que no estén en uso.
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Save, DollarSign, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
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

const EMPTY_NEW_PLAN = {
  name: '',
  price: '',
  group: 'memberships' as PlanGroup,
  single: false,
  classes: '',
};

/** Errores de validación por plan (indexados por campo). */
interface PlanErrors {
  name?: string;
  price?: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('es-CO');
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

  return errors;
}

function hasErrors(errors: PlanErrors): boolean {
  return Boolean(errors.name || errors.price);
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
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Input
              value={plan.name}
              onChange={(e) => onChange({ ...plan, name: e.target.value })}
              placeholder="Nombre del plan"
              aria-label={`Nombre del plan ${plan.id}`}
              aria-invalid={Boolean(errors.name)}
              className={cn('text-sm', errors.name && 'border-destructive')}
            />
            {errors.name && (
              <p className="mt-1 text-xs font-medium text-destructive">
                {errors.name}
              </p>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <DollarSign className="size-4 text-muted-foreground" />
              {/*
                type="text" + inputMode numérico: la validación de "no negativo /
                solo números" la hace el schema Zod, con mensajes claros en vez
                del bloqueo silencioso de type="number".
              */}
              <Input
                type="text"
                inputMode="numeric"
                value={String(plan.price)}
                onChange={(e) => onChange({ ...plan, price: parsePrice(e.target.value) })}
                placeholder="Precio"
                aria-label={`Precio del plan ${plan.id}`}
                aria-invalid={Boolean(errors.price)}
                className={cn('w-32 text-sm', errors.price && 'border-destructive')}
              />
            </div>
            {errors.price && (
              <p className="mt-1 text-xs font-medium text-destructive">
                {errors.price}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan.single && (
            <Badge variant="outline" className="text-xs">
              Clase única
            </Badge>
          )}
          {plan.classesPerMonth && (
            <Badge variant="outline" className="text-xs">
              {plan.classesPerMonth} clases/mes
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Eliminar plan ${plan.name}`}
            title={deleteBlocked ?? undefined}
            disabled={deleteBlocked !== null}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      {deleteBlocked && (
        <p className="text-xs text-muted-foreground">{deleteBlocked}</p>
      )}
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
  const [memberships, setMemberships] = useState<MembershipPlan[]>(
    costs?.memberships ?? [],
  );
  const [personalized, setPersonalized] = useState<MembershipPlan[]>(
    costs?.personalized ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlan, setNewPlan] = useState(EMPTY_NEW_PLAN);
  const [newPlanError, setNewPlanError] = useState('');

  const allPlans = useMemo(
    () => [...memberships, ...personalized],
    [memberships, personalized],
  );

  const handleAddPlan = () => {
    const price = copAmount('El precio').safeParse(newPlan.price);
    const classes = newPlan.classes.trim() && !newPlan.single
      ? positiveInteger('Las clases por mes', 100).safeParse(newPlan.classes)
      : null;
    const plan: MembershipPlan = {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: newPlan.name.trim(),
      price: Number(price.data),
      ...(newPlan.single && { single: true }),
      ...(classes?.success && { classesPerMonth: Number(classes.data) }),
    };
    const errors = validatePlan(plan, allPlans);
    const problem =
      errors.name ??
      (price.success ? null : price.error.issues[0]?.message) ??
      (classes && !classes.success ? classes.error.issues[0]?.message : null);
    if (problem) {
      setNewPlanError(problem);
      return;
    }

    const setGroup = newPlan.group === 'memberships' ? setMemberships : setPersonalized;
    setGroup((plans) => [...plans, plan]);
    setNewPlan(EMPTY_NEW_PLAN);
    setNewPlanError('');
    setShowAddForm(false);
  };

  /** Motivo por el que un plan no se puede eliminar, o null si se puede. */
  const deleteBlockedReason = (plan: MembershipPlan): string | null => {
    if (allPlans.length <= 1) return 'Debe existir al menos un plan.';
    if (!students) return 'Cargando los estudiantes que usan este plan…';
    // Con el nombre guardado: renombrar sin guardar no debe esconder a sus estudiantes.
    const saved = [...(costs?.memberships ?? []), ...(costs?.personalized ?? [])].find(
      (p) => p.id === plan.id,
    );
    const count = countStudentsOnPlan(saved ?? plan, students);
    return count > 0
      ? `En uso por ${count} ${count === 1 ? 'estudiante' : 'estudiantes'}: reasígnalos antes de eliminarlo.`
      : null;
  };

  const handleMembershipChange = (index: number, updated: MembershipPlan) => {
    const next = [...memberships];
    next[index] = updated;
    setMemberships(next);
  };

  const handlePersonalizedChange = (index: number, updated: MembershipPlan) => {
    const next = [...personalized];
    next[index] = updated;
    setPersonalized(next);
  };

  // Errores por plan (recalculados en cada render sobre el estado actual).
  const membershipErrors = useMemo(
    () => memberships.map((p) => validatePlan(p, allPlans)),
    [memberships, allPlans],
  );
  const personalizedErrors = useMemo(
    () => personalized.map((p) => validatePlan(p, allPlans)),
    [personalized, allPlans],
  );

  const isValid = useMemo(
    () =>
      !membershipErrors.some(hasErrors) && !personalizedErrors.some(hasErrors),
    [membershipErrors, personalizedErrors],
  );

  const handleSave = async () => {
    // Bloqueo de guardado si hay errores (STEERING_FORMS §3).
    if (!isValid) {
      toast.error('Corrige los errores antes de guardar.');
      return;
    }
    setSaving(true);
    try {
      // Normaliza precios (asegura número) antes de persistir.
      const normalize = (plans: MembershipPlan[]) =>
        plans.map((p) => ({ ...p, name: p.name.trim(), price: Number(p.price) }));
      await onSave({
        memberships: normalize(memberships),
        personalized: normalize(personalized),
      });
      toast.success('Planes de membresía guardados.');
    } catch {
      toast.error('Error al guardar los planes.');
    } finally {
      setSaving(false);
    }
  };

  const hasPlans = memberships.length > 0 || personalized.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planes de Membresía</CardTitle>
        <CardDescription>
          Crea, edita o elimina los planes de tu academia. Los cambios se aplican al guardar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {!hasPlans && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay planes configurados. Agrega el primero.
          </p>
        )}

        {/* Planes grupales */}
        {memberships.length > 0 && (
          <div className="flex flex-col gap-3">
            <Label>Planes Grupales</Label>
            {memberships.map((plan, index) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                errors={membershipErrors[index] ?? {}}
                onChange={(updated) => handleMembershipChange(index, updated)}
                onDelete={() => setMemberships((plans) => plans.filter((p) => p.id !== plan.id))}
                deleteBlocked={deleteBlockedReason(plan)}
              />
            ))}
          </div>
        )}

        {/* Planes personalizados */}
        {personalized.length > 0 && (
          <div className="flex flex-col gap-3">
            <Label>Planes Personalizados</Label>
            {personalized.map((plan, index) => (
              <PlanRow
                key={plan.id}
                plan={plan}
                errors={personalizedErrors[index] ?? {}}
                onChange={(updated) => handlePersonalizedChange(index, updated)}
                onDelete={() => setPersonalized((plans) => plans.filter((p) => p.id !== plan.id))}
                deleteBlocked={deleteBlockedReason(plan)}
              />
            ))}
          </div>
        )}

        {showAddForm ? (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
            <Label>Nuevo plan</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Nombre del plan"
                aria-label="Nombre del nuevo plan"
                maxLength={100}
                value={newPlan.name}
                onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
              />
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Precio"
                aria-label="Precio del nuevo plan"
                value={newPlan.price}
                onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })}
              />
              <Select
                value={newPlan.group}
                onValueChange={(group) => setNewPlan({ ...newPlan, group: group as PlanGroup })}
              >
                <SelectTrigger className="w-full" aria-label="Tipo de plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="memberships">Grupal</SelectItem>
                  <SelectItem value="personalized">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="new-plan-single"
                  checked={newPlan.single}
                  onCheckedChange={(checked) =>
                    setNewPlan({ ...newPlan, single: checked === true, classes: '' })
                  }
                />
                <Label htmlFor="new-plan-single" className="text-sm">
                  Clase única (no extiende el vencimiento)
                </Label>
              </div>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Clases por mes (opcional)"
                aria-label="Clases por mes"
                className="sm:w-56"
                disabled={newPlan.single}
                value={newPlan.classes}
                onChange={(e) => setNewPlan({ ...newPlan, classes: e.target.value })}
              />
            </div>
            {newPlanError && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {newPlanError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleAddPlan}>
                <Plus className="size-3.5 mr-1" />
                Agregar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setNewPlan(EMPTY_NEW_PLAN);
                  setNewPlanError('');
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="size-3.5 mr-1" />
            Agregar plan
          </Button>
        )}

        {/* Precio formateado como referencia */}
        {hasPlans && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-2">Vista previa de precios:</p>
            <div className="flex flex-wrap gap-2">
              {[...memberships, ...personalized].map((plan) => (
                <Badge key={plan.id} variant="secondary" className="text-xs">
                  {plan.name}: ${formatCurrency(Number(plan.price) || 0)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {hasPlans && (
          <Button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="self-start"
          >
            <Save className="size-4 mr-1.5" />
            {saving ? 'Guardando...' : 'Guardar planes'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
