/**
 * PaymentForm — Formulario responsivo para registrar pagos de mensualidad.
 *
 * Incluye:
 * - Selector de categoría (mensualidad / personalizada)
 * - Selector de plan
 * - Descuento (monto y razón)
 * - Selección de método de pago
 * - Estado del pago (pagado, upgrade, crédito)
 * - Opción de pago dividido (split)
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SplitPaymentEditor } from './SplitPaymentEditor';
import type { MembershipPlan } from '@/types/membership';
import type { PaymentMethod, PaymentSplit } from '@/types/payment';
import type { Student } from '@/types/student';
import type { RegisterPaymentInput } from '@/services/PaymentService';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type PaymentCategory = 'mensualidad' | 'personalizada';
type PaymentStatus = 'paid' | 'upgrade' | 'credit';

interface PaymentFormValues {
  date: string;
  category: PaymentCategory;
  planId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  discount: string;
  discountReason: string;
  useSplit: boolean;
}

interface PaymentFormProps {
  student: Student;
  groupPlans: MembershipPlan[];
  personalizedPlans: MembershipPlan[];
  onSubmit: (input: RegisterPaymentInput) => Promise<void>;
  submitting?: boolean;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Nequi', label: 'Nequi' },
  { value: 'Banco', label: 'Banco' },
];

const STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Pagado' },
  { value: 'upgrade', label: 'Upgrade de plan' },
  { value: 'credit', label: 'Crédito' },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function PaymentForm({
  student,
  groupPlans,
  personalizedPlans,
  onSubmit,
  submitting = false,
}: PaymentFormProps) {
  const [splits, setSplits] = useState<PaymentSplit[]>([]);

  const form = useForm<PaymentFormValues>({
    defaultValues: {
      date: todayISO(),
      category: student.planCategory ?? 'mensualidad',
      planId: student.planId ?? '',
      status: 'paid',
      method: 'Efectivo',
      discount: '0',
      discountReason: '',
      useSplit: false,
    },
  });

  const watchCategory = form.watch('category');
  const watchPlanId = form.watch('planId');
  const watchDiscount = form.watch('discount');
  const watchUseSplit = form.watch('useSplit');

  // Planes según la categoría seleccionada
  const activePlans = useMemo(
    () => (watchCategory === 'mensualidad' ? groupPlans : personalizedPlans),
    [watchCategory, groupPlans, personalizedPlans],
  );

  // Plan seleccionado actualmente
  const selectedPlan = useMemo(
    () => activePlans.find((p) => p.id === watchPlanId) ?? null,
    [activePlans, watchPlanId],
  );

  // Total con descuento
  const totalAmount = useMemo(() => {
    if (!selectedPlan) return 0;
    const discount = Number(watchDiscount) || 0;
    return Math.max(0, selectedPlan.price - discount);
  }, [selectedPlan, watchDiscount]);

  // Manejar envío
  const handleSubmit = form.handleSubmit(async (values) => {
    const plan = activePlans.find((p) => p.id === values.planId);
    if (!plan) return;

    const input: RegisterPaymentInput = {
      studentId: student.id,
      date: values.date,
      plan,
      category: values.category,
      method: values.method,
      status: values.status,
      discount: Number(values.discount) || 0,
      discountReason: values.discountReason.trim(),
      splits: values.useSplit && splits.length > 0 ? splits : undefined,
    };

    await onSubmit(input);
    form.reset({
      date: todayISO(),
      category: values.category,
      planId: values.planId,
      status: 'paid',
      method: 'Efectivo',
      discount: '0',
      discountReason: '',
      useSplit: false,
    });
    setSplits([]);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info del estudiante */}
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-sm font-medium text-foreground">
            {student.firstName} {student.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            Doc: {student.documentId} | Plan actual: {student.planName}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Fecha */}
          <FormField
            control={form.control}
            name="date"
            rules={{ required: 'La fecha es obligatoria.' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha del pago</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Estado del pago */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de pago</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Categoría */}
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(val) => {
                    field.onChange(val);
                    form.setValue('planId', '');
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mensualidad">Mensualidad (Grupal)</SelectItem>
                    <SelectItem value="personalizada">Personalizada</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Plan */}
          <FormField
            control={form.control}
            name="planId"
            rules={{ required: 'Selecciona un plan.' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plan</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar plan" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {activePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — ${plan.price.toLocaleString('es-CO')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Método de pago */}
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Método de pago</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Descuento */}
          <FormField
            control={form.control}
            name="discount"
            rules={{
              validate: (v) => {
                const num = Number(v);
                if (num < 0) return 'El descuento no puede ser negativo.';
                if (selectedPlan && num >= selectedPlan.price) {
                  return 'El descuento no puede ser mayor o igual al precio.';
                }
                return true;
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descuento ($)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Razón del descuento */}
          <FormField
            control={form.control}
            name="discountReason"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Razón del descuento (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej. Pronto pago, promoción..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Total calculado */}
        {selectedPlan && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total a pagar</span>
              <span className="text-lg font-bold text-foreground">
                ${totalAmount.toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        )}

        {/* Pago dividido */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="useSplit"
              checked={watchUseSplit}
              onCheckedChange={(checked) => {
                form.setValue('useSplit', checked === true);
                if (!checked) setSplits([]);
              }}
            />
            <Label htmlFor="useSplit" className="text-sm cursor-pointer">
              Dividir pago entre varios métodos
            </Label>
          </div>

          {watchUseSplit && (
            <SplitPaymentEditor
              totalAmount={totalAmount}
              splits={splits}
              onChange={setSplits}
            />
          )}
        </div>

        {/* Botón de envío */}
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={submitting || form.formState.isSubmitting}
        >
          {submitting || form.formState.isSubmitting
            ? 'Registrando pago…'
            : 'Registrar pago'}
        </Button>
      </form>
    </Form>
  );
}
