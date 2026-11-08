/**
 * SalesTab — Pestaña Ventas de Finanzas: registrar una venta e historial.
 */

import { useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useInventory } from '@/hooks/useInventory';
import { useSales } from '@/hooks/useSales';
import type { CreateSaleInput } from '@/services/SaleService';

import { SaleForm } from './SaleForm';
import { SaleHistory } from './SaleHistory';

export function SalesTab({ onSold }: { onSold?: () => void }) {
  const { sales, loading, registerSale } = useSales();
  const { items, refreshData: refreshInventory } = useInventory();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (input: CreateSaleInput) => {
    setSaving(true);
    const result = await registerSale(input);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success('Venta registrada.');
    await refreshInventory(); // la venta descontó stock
    onSold?.();
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Registrar venta</CardTitle>
        </CardHeader>
        <CardContent>
          <SaleForm inventory={items} onSubmit={handleSubmit} submitting={saving} />
        </CardContent>
      </Card>
      <SaleHistory sales={sales} loading={loading} />
    </div>
  );
}
