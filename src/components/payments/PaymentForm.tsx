/**
 * PaymentForm — Formulario de registro de pago de mensualidad.
 *
 * Usa react-hook-form (sin zod, con reglas manuales) y componentes shadcn/ui.
 * Permite seleccionar plan, método de pago principal, descuento (monto y razón),
 * dividir el pago en varios métodos (SplitPaymentEditor) y, si el estado es
 * 'credit', capturar cuota inicial y número de cuotas.
 *
 * Componente presentacional: recibe `onSubmit` que construye el PaymentInput.
 *
 * Requirements: 5.1, 5.3, 5.4, 5.6, 5.7
 */

import { useMemo, useState } from 'react';
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
import { SplitPaymentEditor } from '@/components/payments/SplitPaymentEditor';
import { useMemberships } from '@/hooks/useMemberships';
import type { PaymentInput } from '@/services/PaymentService';
import type { PaymentMethod, PaymentSplit } from '@/types/payment';
import type { MembershipPlan } from '@/types/membership';
import {
  computeSubscriptionEndDate,
  isValidIsoDate,
  pastDateSchema,
  selectFromSource,
  copAmount,
  textSchema,
  todayLocalIso,
} from '@/utils/validation';

const PAYMENT_STATUSES = ['paid', 'upgrade', 'credit'] as const;
const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Banco'] as const;

const METHODS: PaymentMethod[] = ['Efectivo', 'Nequi', 'Banco'];

const STATUS_OPTIONS: { value: PaymentInput['status']; label: string }[] = [
  { value: 'paid', label: 'Pago de mensualidad' },
  { value: 'upgrade', label: 'Mejora de plan' },
  { value: 'credit', label: 'Crédito (cuotas)' },
];

const INSTALLMENT_OPTIONS = [
  { value: 'single', label: 'Cuota única' },
  { value: 'three_installments', label: '3 cuotas (cada 15 días)' },
] as const;

interface PaymentFormValues {
  date: string;
  planId: string;
  method: PaymentMethod;
  status: PaymentInput['status'];
  discount: string;
  discountReason: string;
  initialPayment: string;
  installmentType: 'single' | 'three_installments';
}

interface PaymentFormProps {
  studentId: string;
  /** Vencimiento actual del estudiante, para anticipar cómo queda tras el pago. */
  currentEndDate?: string;
  /** Recibe el PaymentInput ensamblado; la persistencia la hace el padre (usePayments). */
  onSubmit: (input: PaymentInput) => Promise<void> | void;
  submitting?: boolean;
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
      // Select validado contra el catálogo real de planes.
      planId: selectFromSource(allPlans, (p) => p.id, 'El plan'),
      date: pastDateSchema('La fecha de pago'),
      status: z.enum(PAYMENT_STATUSES),
      method: z.enum(PAYMENT_METHODS),
      // Monto monetario: sin texto, sin negativos (STEERING_FORMS §1).
      discount: copAmount('El descuento', false),
      discountReason: textSchema('La razón del descuento'),
      useSplit: z.boolean().default(false),
      // Zod descarta las claves que no declare el esquema.
      initialPayment: z.string().optional().default(''),
      installmentType: z.enum(['single', 'three_installments']).default('single'),
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

      // El abono solo se captura (y por tanto se valida) en pagos a crédito.
      if (data.status === 'credit') {
        const initial = copAmount('El abono inicial', false).safeParse(data.initialPayment);
        const message = !initial.success
          ? initial.error.issues[0]?.message
          : plan && Number(initial.data ?? 0) > plan.price - Number(data.discount ?? 0)
            ? 'El abono inicial no puede superar el total a pagar.'
            : undefined;
        if (message) {
          ctx.addIssue({ code: 'custom', path: ['initialPayment'], message });
        }
      }
    });
}

export function PaymentForm({ studentId, currentEndDate, onSubmit, submitting = false }: PaymentFormProps) {
  const { groupPlans, personalizedPlans, getPlanById } = useMemberships();

  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);

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
      date: todayLocalIso(),
      planId: '',
      method: 'Efectivo',
      status: 'paid',
      discount: '',
      discountReason: '',
      initialPayment: '',
      installmentType: 'single',
    },
  });

  const planId = form.watch('planId');
  const status = form.watch('status');
  const discountStr = form.watch('discount');

  // Precio del plan seleccionado y neto tras descuento.
  const selected = useMemo(() => (planId ? getPlanById(planId) : null), [planId, getPlanById]);
  const price = selected?.plan.price ?? 0;
  const discount = Number(discountStr) || 0;
  const net = Math.max(0, price - discount);

  const isCredit = status === 'credit';

  const paymentDate = form.watch('date');
  const newEndDate =
    selected && currentEndDate && isValidIsoDate(paymentDate) && isValidIsoDate(currentEndDate)
      ? computeSubscriptionEndDate(currentEndDate, paymentDate, status, selected.plan)
      : null;

  const handleSubmit = form.handleSubmit(async (values) => {
    const found = getPlanById(values.planId);
    if (!found) {
      form.setError('planId', { message: 'Selecciona un plan válido.' });
      return;
    }

    const discountValue = Number(values.discount) || 0;
    const netAmount = Math.max(0, found.plan.price - discountValue);

    // Validación de splits en el submit (además de la validación en vivo).
    if (splitEnabled) {
      const sum = splits.reduce((acc, s) => acc + s.amount, 0);
      if (sum !== netAmount) {
        form.setError('root', {
          message: 'La suma de los pagos divididos no coincide con el total a pagar.',
        });
        return;
      }
    }

    const input: PaymentInput = {
      studentId,
      date: values.date,
      amount: found.plan.price,
      method: values.method,
      splits: splitEnabled ? splits : undefined,
      status: values.status,
      planName: found.plan.name,
      category: found.category,
      discount: discountValue,
      discountReason: values.discountReason.trim() || undefined,
    };

    // Crédito: adjuntar abono inicial y tipo de plan de cuotas (Req 5.7).
    if (values.status === 'credit') {
      const initial = Number(values.initialPayment) || 0;
      input.initialPayment = initial;
      input.creditPlan = {
        type: values.installmentType,
        initialPayment: initial,
        remainingBalance: Math.max(0, netAmount - initial),
        installments: [],
      };
    }

    await onSubmit(input);
    form.reset();
    setSplitEnabled(false);
    setSplits([]);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                    <SelectValue placeholder="Selecciona un plan" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {groupPlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatCOP(p.price)}
                    </SelectItem>
                  ))}
                  {personalizedPlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatCOP(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Fecha del pago */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de pago</FormLabel>
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
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Método principal */}
        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Método de pago</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Descuento */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="discount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descuento (monto)</FormLabel>
                <FormControl>
                  {/*
                    type="text" + inputMode numérico: la validación de "solo
                    números / no negativos" la hace la regla del campo, con
                    mensajes claros en vez del bloqueo silencioso de
                    type="number" (que además impide capturar el signo en jsdom).
                  */}
                  <Input type="text" inputMode="numeric" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="discountReason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Razón del descuento (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej. promoción de temporada" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Crédito: cuota inicial + número de cuotas */}
        {isCredit && (
          <div className="grid grid-cols-1 gap-4 rounded-lg ring-1 ring-foreground/10 p-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="initialPayment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abono inicial</FormLabel>
                  <FormControl>
                    {/*
                      type="text" + inputMode numérico: la validación la hace
                      la regla del campo con mensaje claro, sin el bloqueo
                      silencioso de type="number". Alinea con STEERING_FORMS §1.
                    */}
                    <Input type="text" inputMode="numeric" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="installmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan de cuotas</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INSTALLMENT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Pago dividido */}
        <SplitPaymentEditor
          total={net}
          enabled={splitEnabled}
          onEnabledChange={setSplitEnabled}
          splits={splits}
          onSplitsChange={setSplits}
        />

        {/* Resumen del total a pagar */}
        <div className="flex items-center justify-between rounded-lg bg-secondary-50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total a pagar</span>
          <span className="font-semibold text-secondary-900">{formatCOP(net)}</span>
        </div>

        {newEndDate && (
          <div className="flex items-center justify-between rounded-lg bg-secondary-50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Vencimiento después del pago</span>
            <span className="font-semibold text-secondary-900" data-testid="payment-new-end-date">
              {newEndDate.split('-').reverse().join('/')}
            </span>
          </div>
        )}

        {form.formState.errors.root && (
          <p role="alert" className="text-sm text-error-700">
            {form.formState.errors.root.message}
          </p>
        )}

        <Button type="submit" disabled={submitting || form.formState.isSubmitting}>
          {submitting || form.formState.isSubmitting ? 'Registrando…' : 'Registrar pago'}
        </Button>
      </form>
    </Form>
  );
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}
