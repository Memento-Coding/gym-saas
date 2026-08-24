/**
 * PlanEditor — Editor de planes de membresía.
 *
 * Muestra planes grupales y personalizados en filas editables.
 * Permite cambiar nombre y precio de cada plan.
 *
 * Requirements: 4.4, 15.1
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { CostsConfig, MembershipPlan } from '@/types/membership';

interface PlanEditorProps {
  costs: CostsConfig | null;
  onSave: (config: CostsConfig) => Promise<void>;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('es-CO');
}

function PlanRow({
  plan,
  onChange,
}: {
  plan: MembershipPlan;
  onChange: (updated: MembershipPlan) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            value={plan.name}
            onChange={(e) => onChange({ ...plan, name: e.target.value })}
            placeholder="Nombre del plan"
            className="text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="size-4 text-muted-foreground" />
          <Input
            type="number"
            value={plan.price}
            onChange={(e) => onChange({ ...plan, price: Number(e.target.value) || 0 })}
            placeholder="Precio"
            className="w-32 text-sm"
            min={0}
          />
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
  );
}

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

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ memberships, personalized });
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
                  {plan.name}: ${formatCurrency(plan.price)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {hasPlans && (
          <Button onClick={handleSave} disabled={saving} className="self-start">
            <Save className="size-4 mr-1.5" />
            {saving ? 'Guardando...' : 'Guardar planes'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
