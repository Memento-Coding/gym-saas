/**
 * useInventory — Custom hook para el módulo de inventario.
 *
 * Envuelve el InventoryService y gestiona estado reactivo para:
 * - Lista de ítems (productos y servicios).
 * - Acciones CRUD: crear, actualizar, eliminar.
 * - Reabastecimiento de stock (restock).
 * - Estados de carga (loading) y error.
 *
 * Todas las mutaciones propagan el ServiceResult del servicio para que la UI
 * reaccione a éxito/error (por ejemplo, mostrar un toast).
 *
 * Requirements: 8.1, 8.5
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getStorageService } from '@/services/storage';
import {
  InventoryService,
  type CreateInventoryItemInput,
  type ServiceResult,
} from '@/services/InventoryService';
import type { InventoryItem } from '@/types/inventory';

export interface UseInventoryReturn {
  items: InventoryItem[];
  products: InventoryItem[];
  services: InventoryItem[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  createItem: (input: CreateInventoryItemInput) => Promise<ServiceResult<InventoryItem>>;
  updateItem: (
    id: string,
    changes: Partial<Omit<InventoryItem, 'id'>>,
  ) => Promise<ServiceResult<InventoryItem>>;
  deleteItem: (id: string) => Promise<ServiceResult<string>>;
  restock: (id: string, quantity: number) => Promise<ServiceResult<InventoryItem>>;
}

export function useInventory(): UseInventoryReturn {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [service, setService] = useState<InventoryService | null>(null);

  // Inicializa el servicio una sola vez.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        const svc = new InventoryService(storage);
        if (!cancelled) setService(svc);
      } catch {
        if (!cancelled) {
          setError('Error al inicializar el servicio de inventario.');
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!service) return;
    setLoading(true);
    setError(null);
    try {
      const data = await service.getAll();
      setItems(data);
    } catch {
      setError('Error al cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    if (service) refreshData();
  }, [service, refreshData]);

  const products = useMemo(() => items.filter((i) => i.kind === 'product'), [items]);
  const services = useMemo(() => items.filter((i) => i.kind === 'service'), [items]);

  /** Ejecuta una mutación y, si tiene éxito, recarga la lista. */
  const runMutation = useCallback(
    async <T>(action: () => Promise<ServiceResult<T>>): Promise<ServiceResult<T>> => {
      if (!service) {
        return { success: false, error: 'El servicio de inventario no está listo.' };
      }
      setError(null);
      try {
        const result = await action();
        if (result.success) {
          await refreshData();
        } else {
          setError(result.error);
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
        setError(message);
        return { success: false, error: message };
      }
    },
    [service, refreshData],
  );

  const createItem = useCallback(
    (input: CreateInventoryItemInput) => runMutation(() => service!.create(input)),
    [runMutation, service],
  );

  const updateItem = useCallback(
    (id: string, changes: Partial<Omit<InventoryItem, 'id'>>) =>
      runMutation(() => service!.update(id, changes)),
    [runMutation, service],
  );

  const deleteItem = useCallback(
    (id: string) => runMutation(() => service!.delete(id)),
    [runMutation, service],
  );

  const restock = useCallback(
    (id: string, quantity: number) => runMutation(() => service!.restock(id, quantity)),
    [runMutation, service],
  );

  return {
    items,
    products,
    services,
    loading,
    error,
    refreshData,
    createItem,
    updateItem,
    deleteItem,
    restock,
  };
}
