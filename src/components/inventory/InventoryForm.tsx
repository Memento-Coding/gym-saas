/**
 * InventoryForm — Formulario de creación/edición de ítems de inventario.
 *
 * Diferencia Productos (con stock físico) de Servicios (sin stock). Valida con
 * Zod conforme al STEERING_FORMS: nombre requerido, costo/precio no negativos,
 * stock entero no negativo (solo productos). Los inputs numéricos usan
 * type="text" inputMode="numeric" para evitar el bloqueo silencioso de
 * type="number" y problemas en jsdom.
 *
 * Componente presentacional: recibe onSubmit y NO persiste; la persistencia la
 * hace el padre vía useInventory.
 *
 * Requirements: 8.1, 8.5
 */

import { useMemo } from 'react';
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
import { nonNegativeAmount, integerInRange, messages } from '@/utils/validation';
import type { CreateInventoryItemInput } from '@/services/InventoryService';
import type { InventoryItem } from '@/types/inventory';

interface InventoryFormValues {
  kind: 'product' | 'service';
  name: string;
  cost: string;
  price: string;
  stock: string;
}

export interface InventoryFormProps {
  /** Datos iniciales para edición. */
  defaultValues?: Partial<InventoryItem>;
  onSubmit: (input: CreateInventoryItemInput) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
}

const KIND_OPTIONS = [
  { value: 'product', label: 'Producto (con stock)' },
  { value: 'service', label: 'Servicio (sin stock)' },
] as const;

/** Stock máximo defensivo para la validación de enteros. */
const MAX_STOCK = 1_000_000;

/**
 * Schema Zod: costo/precio no negativos siempre; stock entero >= 0 solo cuando
 * el ítem es un producto (validación condicional en superRefine).
 */
function buildSchema() {
  return z
    .object({
      kind: z.enum(['product', 'service']),
      name: z
        .string({ error: messages.required('El nombre') })
        .trim()
        .min(1, { message: messages.required('El nombre') }),
      cost: nonNegativeAmount('El costo'),
      price: nonNegativeAmount('El precio'),
      // Se valida condicionalmente según kind en el superRefine.
      stock: z.string().optional().default(''),
    })
    .superRefine((data, ctx) => {
      if (data.kind === 'product') {
        const result = integerInRange('El stock', 0, MAX_STOCK).safeParse(data.stock);
        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['stock'],
            message: result.error.issues[0]?.message ?? 'El stock no es válido.',
          });
        }
      }
    });
}

export function InventoryForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting = false,
}: InventoryFormProps) {
  const resolver = useMemo(
    () => zodResolver(buildSchema()) as unknown as Resolver<InventoryFormValues>,
    [],
  );

  const form = useForm<InventoryFormValues>({
    resolver,
    mode: 'onSubmit',
    defaultValues: {
      kind: defaultValues?.kind ?? 'product',
      name: defaultValues?.name ?? '',
      cost: defaultValues?.cost != null ? String(defaultValues.cost) : '',
      price: defaultValues?.price != null ? String(defaultValues.price) : '',
      stock:
        defaultValues?.stock != null && defaultValues.stock !== undefined
          ? String(defaultValues.stock)
          : '',
    },
  });

  const kind = form.watch('kind');
  const isProduct = kind === 'product';

  const handleSubmit = form.handleSubmit(async (values) => {
    const input: CreateInventoryItemInput = {
      kind: values.kind,
      name: values.name.trim(),
      cost: Number(values.cost),
      price: Number(values.price),
      stock: values.kind === 'product' ? Number(values.stock) : null,
    };
    await onSubmit(input);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Tipo de ítem */}
        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
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

        {/* Nombre */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Nombre <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Ej. Guantes de boxeo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Costo y precio */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Costo</FormLabel>
                <FormControl>
                  <Input type="text" inputMode="numeric" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio</FormLabel>
                <FormControl>
                  <Input type="text" inputMode="numeric" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Stock (solo productos) */}
        {isProduct && (
          <FormField
            control={form.control}
            name="stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Stock inicial <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input type="text" inputMode="numeric" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={submitting || form.formState.isSubmitting}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
