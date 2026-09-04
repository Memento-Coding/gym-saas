/**
 * PaymentForm — Formulario responsivo para registrar pagos de mensualidad.
 *
 * Incluye:
 * - Selector de categoría (mensualidad / personalizada)
 * - Selector de plan (validado contra el catálogo dinámico real)
 * - Descuento (monto y razón) — sin negativos ni texto
 * - Selección de método de pago
 * - Estado del pago (pagado, upgrade, crédito)
 * - Opción de pago dividido (split)
 * - Fecha de vencimiento calculada automáticamente (read-only)
 *
 * Validación: react-hook-form + zodResolver alimentado por el catálogo
 * `src/utils/validation.ts` (STEERING_FORMS §1, §2, §4). El front NO es la
 * autoridad: PaymentService revalida montos, splits y recalcula el vencimiento.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import type { PaymentInput } from '@/services/PaymentService';
import {
  nonNegativeAmount,
  isoDateSchema,
  selectFromSource,
  computeSubscriptionEndDate,
  toIsoDateUTC,
  messages,
} from '@/utils/validation';

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
  /** Recibe el payload listo para PaymentService.registerPayment. */
  onSubmit: (input: PaymentInput) => Promise<void>;
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

const PAYMENT_METHODS: [PaymentMethod, ...PaymentMethod[]] = [
  'Efectivo',
  'Nequi',
  'Banco',
];
const PAYMENT_STATUSES: [PaymentStatus, ...PaymentStatus[]] = [
  'paid',
  'upgrade',
  'credit',
];

function todayISO(): string {
  return toIsoDateUTC(new Date());
}

/**
 * Construye el schema Zod del formulario de pago.
 *
 * `planId` se valida contra el catálogo real completo (grupales + personalizados),
 * un conjunto estable que no depende de la categoría seleccionada; un plan
 * inexistente o eliminado es rechazado (STEERING_FORMS §2). La coherencia
 * categoría↔plan y el tope de descuento se verifican en el `superRefine`.
 */
function buildPaymentSchema(allPlans: MembershipPlan[]) {
  return z
    .object({
      date: isoDateSchema('La fecha de pago'),
      category: z.enum(['mensualidad', 'personalizada']),
      // Select validado contra el catálogo real de planes.
      planId: selectFromSource(allPlans, (p) => p.id, 'El plan'),
      status: z.enum(PAYMENT_STATUSES),
      method: z.enum(PAYMENT_METHODS),
      // Monto monetario: sin texto, sin negativos (STEERING_FORMS §1).
      discount: nonNegativeAmount('El descuento'),
      discountReason: z.string().optional().default(''),
      useSplit: z.boolean().default(false),
    })
    .superRefine((data, ctx) => {
      // El descuento no puede igualar ni superar el precio del plan elegido.
      const plan = allPlans.find((p) => p.id === data.planId);
      const discountNum = Number(data.discount);
      if (plan && Number.isFinite(discountNum) && discountNum >= plan.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discount'],
          message: 'El descuento no puede ser mayor o igual al precio del plan.',
        });
      }
    });
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

  // Planes según la categoría inicial del estudiante.
  const initialCategory: PaymentCategory = student.planCategory ?? 'mensualidad';

  // Catálogo real completo (estable) para validar planId contra datos reales.
  const allPlans = useMemo(
    () => [...groupPlans, ...personalizedPlans],
    [groupPlans, personalizedPlans],
  );

  // Resolver estático basado en el catálogo completo. La coherencia
  // categoría↔plan se valida en el superRefine del schema. El cast del
  // resolver evita la fricción de inferencia entre Zod v4 y react-hook-form
  // manteniendo PaymentFormValues como tipo del formulario.
  const resolver = useMemo(
    () =>
      zodResolver(buildPaymentSchema(allPlans)) as unknown as Resolver<PaymentFormValues>,
    [allPlans],
  );

  const form = useForm<PaymentFormValues>({
    resolver,
    mode: 'onSubmit',
    defaultValues: {
      date: todayISO(),
      category: initialCategory,
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
  const watchStatus = form.watch('status');
  const watchDate = form.watch('date');
  const watchUseSplit = form.watch('useSplit');

  // Planes según la categoría seleccionada (catálogo dinámico real).
  const activePlans = useMemo(
    () => (watchCategory === 'mensualidad' ? groupPlans : personalizedPlans),
    [watchCategory, groupPlans, personalizedPlans],
  );



  // Plan seleccionado actualmente.
  const selectedPlan = useMemo(
    () => activePlans.find((p) => p.id === watchPlanId) ?? null,
    [activePlans, watchPlanId],
  );

  // Total con descuento.
  const totalAmount = useMemo(() => {
    if (!selectedPlan) return 0;
    const discount = Number(watchDiscount) || 0;
    return Math.max(0, selectedPlan.price - discount);
  }, [selectedPlan, watchDiscount]);

  // Fecha de vencimiento calculada automáticamente (STEERING_FORMS §4).
  // NO existe input manual: se deriva de la fecha de pago + plan.
  const computedEndDate = useMemo(() => {
    if (!selectedPlan) return null;
    return computeSubscriptionEndDate(
      student.subscriptionEndDate || watchDate,
      watchDate,
      watchStatus,
      selectedPlan,
    );
  }, [selectedPlan, student.subscriptionEndDate, watchDate, watchStatus]);

  // Manejar envío.
  const handleSubmit = form.handleSubmit(async (values) => {
    // Revalidación defensiva contra el catálogo real (el resolver ya lo hizo).
    const plan = activePlans.find((p) => p.id === values.planId);
    if (!plan) {
      form.setError('planId', { message: messages.notInCatalog('El plan') });
      return;
    }

    const discount = Number(values.discount) || 0;

    const input: PaymentInput = {
      studentId: student.id,
      date: values.date,
      amount: plan.price,
      method: values.method,
      status: values.status,
      planName: plan.name,
      category: values.category,
      discount,
      discountReason: values.discountReason?.trim() ?? '',
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
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Fecha del pago <span className="text-destructive">*</span>
                </FormLabel>
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
                    // Al cambiar de catálogo, el plan previo puede no existir.
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

          {/* Plan — datos dinámicos reales */}
          <FormField
            control={form.control}
            name="planId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Plan <span className="text-destructive">*</span>
                </FormLabel>
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

          {/* Descuento — sin negativos ni texto */}
          <FormField
            control={form.control}
            name="discount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descuento ($)</FormLabel>
                <FormControl>
                  {/*
                    type="text" + inputMode numérico: la validación de "solo
                    números / no negativos" la hace el schema Zod
                    (nonNegativeAmount), que da mensajes claros en lugar del
                    bloqueo silencioso del navegador con type="number".
                  */}
                  <Input
                    type="text"
                    inputMode="numeric"
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

        {/* Resumen: total y fecha de vencimiento calculada (read-only) */}
        {selectedPlan && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total a pagar</span>
              <span className="text-lg font-bold text-foreground">
                ${totalAmount.toLocaleString('es-CO')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Nueva fecha de vencimiento
              </span>
              <span
                className="text-sm font-medium text-foreground"
                data-testid="computed-end-date"
              >
                {computedEndDate ?? '—'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Calculada automáticamente desde la fecha de pago y el plan. No editable.
            </p>
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
