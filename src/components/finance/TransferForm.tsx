/**
 * TransferForm — Formulario para registrar traslados entre cajas o entre
 * métodos de pago.
 *
 * Usa los componentes Form, Input, Select y Button de shadcn/ui. Al enviar,
 * invoca la función `transfer` del hook useFinance, que crea el par de
 * movimientos balanceados (débito + crédito) mediante FinanceService.
 *
 * Requirements: 7.3
 */

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
import type { FinanceBox, TransferInput } from '@/services/FinanceService';
import type { PaymentMethod } from '@/types/payment';

const BOXES: { value: FinanceBox; label: string }[] = [
  { value: 'servicios', label: 'Servicios' },
  { value: 'almacen', label: 'Almacén' },
];

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Nequi', label: 'Nequi' },
  { value: 'Banco', label: 'Banco' },
];

/** Valor centinela para "sin método específico" (traslado solo entre cajas). */
const NO_METHOD = '__none__';

interface TransferFormValues {
  date: string;
  amount: string;
  fromBox: FinanceBox;
  toBox: FinanceBox;
  fromMethod: string;
  toMethod: string;
  concept: string;
}

interface TransferFormProps {
  onSubmit: (input: TransferInput) => Promise<void>;
  /** Estado de envío controlado externamente (opcional). */
  submitting?: boolean;
}

/** Fecha de hoy en formato YYYY-MM-DD para el input date. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransferForm({ onSubmit, submitting = false }: TransferFormProps) {
  const form = useForm<TransferFormValues>({
    defaultValues: {
      date: todayISO(),
      amount: '',
      fromBox: 'servicios',
      toBox: 'almacen',
      fromMethod: NO_METHOD,
      toMethod: NO_METHOD,
      concept: '',
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const amount = Number(values.amount);

    const input: TransferInput = {
      date: new Date(values.date).toISOString(),
      amount,
      fromBox: values.fromBox,
      toBox: values.toBox,
      fromMethod: values.fromMethod === NO_METHOD ? undefined : (values.fromMethod as PaymentMethod),
      toMethod: values.toMethod === NO_METHOD ? undefined : (values.toMethod as PaymentMethod),
      concept: values.concept.trim() || undefined,
    };

    await onSubmit(input);
    form.reset({
      date: todayISO(),
      amount: '',
      fromBox: values.fromBox,
      toBox: values.toBox,
      fromMethod: NO_METHOD,
      toMethod: NO_METHOD,
      concept: '',
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Fecha */}
        <FormField
          control={form.control}
          name="date"
          rules={{ required: 'La fecha es obligatoria.' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Monto */}
        <FormField
          control={form.control}
          name="amount"
          rules={{
            required: 'El monto es obligatorio.',
            validate: (v) =>
              (Number(v) > 0 && Number.isFinite(Number(v))) ||
              'El monto debe ser mayor que cero.',
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Caja origen */}
        <FormField
          control={form.control}
          name="fromBox"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Caja origen</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona caja" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BOXES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Caja destino */}
        <FormField
          control={form.control}
          name="toBox"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Caja destino</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona caja" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BOXES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Método origen */}
        <FormField
          control={form.control}
          name="fromMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Método origen</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_METHOD}>Sin especificar</SelectItem>
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

        {/* Método destino */}
        <FormField
          control={form.control}
          name="toMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Método destino</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_METHOD}>Sin especificar</SelectItem>
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

        {/* Concepto (opcional) */}
        <FormField
          control={form.control}
          name="concept"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Concepto (opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Ej. Traslado de caja diaria" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="sm:col-span-2">
          <Button type="submit" disabled={submitting || form.formState.isSubmitting}>
            {submitting || form.formState.isSubmitting ? 'Registrando…' : 'Registrar traslado'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
