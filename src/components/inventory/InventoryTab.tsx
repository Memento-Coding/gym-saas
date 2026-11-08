/**
 * InventoryTab — Pestaña Inventario de Finanzas: catálogo con alta, edición y borrado.
 */

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInventory } from '@/hooks/useInventory';
import type { CreateInventoryItemInput } from '@/services/InventoryService';
import type { InventoryItem } from '@/types/inventory';

import { InventoryForm } from './InventoryForm';
import { InventoryList } from './InventoryList';

export function InventoryTab() {
  const { items, loading, createItem, updateItem, deleteItem } = useInventory();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  const openForm = (item: InventoryItem | null) => {
    setEditing(item);
    setOpen(true);
  };

  const handleSubmit = async (input: CreateInventoryItemInput) => {
    setSaving(true);
    const result = editing ? await updateItem(editing.id, input) : await createItem(input);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(editing ? 'Ítem actualizado.' : 'Ítem creado.');
    setOpen(false);
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!window.confirm(`¿Eliminar «${item.name}» del inventario?`)) return;
    const result = await deleteItem(item.id);
    if (result.success) toast.success('Ítem eliminado.');
    else toast.error(result.error);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => openForm(null)}>Nuevo ítem</Button>
      </div>
      <InventoryList items={items} loading={loading} onEdit={openForm} onDelete={handleDelete} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar ítem' : 'Nuevo ítem'}</DialogTitle>
            <DialogDescription>Productos con stock o servicios sin stock.</DialogDescription>
          </DialogHeader>
          <InventoryForm
            key={editing?.id ?? 'new'}
            defaultValues={editing ?? undefined}
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
            submitting={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
