/**
 * PlanEditor — Editor de planes de membresía.
 *
 * Muestra planes grupales y personalizados en filas editables.
 * Permite cambiar nombre y precio de cada plan.
 *
 * Validación: usa el catálogo `src/utils/validation.ts` (STEERING_FORMS §1, §3).
 * Este editor alimenta el catálogo de membresías que consume PaymentForm, por lo
 * que la integridad de los datos aquí es crítica:
 *  - El precio no puede ser negativo ni no numérico (nonNegativeAmount).
 *  - El nombre del plan es obligatorio y debe ser único dentro de su grupo.
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
import { Save, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { CostsConfig, MembershipPlan } from '@/types/membership';
import { nonNegativeAmount, messages } from '@/utils/validation';

interface PlanEditorProps {
  costs: CostsConfig | null;
  onSave: (config: CostsConfig) => Promise<void>;
}

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
const priceSchema = nonNegativeAmount('El precio');

/**
 * Valida un plan individual contra el estándar. `siblings` son los otros planes
 * del mismo grupo, para verificar unicidad de nombre.
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
  } else if (
    // Unicidad de nombre dentro del grupo (case-insensitive), excluyéndose.
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
}: {
  plan: MembershipPlan;
  errors: PlanErrors;
  onChange: (updated: MembershipPlan) => void;
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
        </div>
      </div>
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

export function PlanEditor({ costs, onSave }: PlanEditorProps) {
  const [memberships, setMemberships] = useState<MembershipPlan[]>(
    costs?.memberships ?? [],
  );
  const [personalized, setPersonalized] = useState<MembershipPlan[]>(
    costs?.personalized ?? [],
  );
  const [saving, setSaving] = useState(false);

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
    () => memberships.map((p) => validatePlan(p, memberships)),
    [memberships],
  );
  const personalizedErrors = useMemo(
    () => personalized.map((p) => validatePlan(p, personalized)),
    [personalized],
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
          Edita los nombres y precios de los planes de tu academia.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {!hasPlans && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay planes configurados. Los planes se crearán automáticamente al registrar
            el primer estudiante o importar un backup.
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
              />
            ))}
          </div>
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
