/**
 * useSales — Custom hook para el módulo de ventas.
 *
 * Orquesta SaleService (registro de venta contado/crédito + comprobante) e
 * InventoryService (descuento automático de stock). El registro de una venta:
 *  1. Descuenta el stock de los productos con InventoryService.applySale
 *     (operación atómica: si falta stock, se rechaza sin efectos).
 *  2. Solo si el descuento tuvo éxito, crea la venta con SaleService.createSale.
 *
 * Expone el historial de ventas y estados de carga/error.
 *
 * Requirements: 9.1, 9.2, 9.4
 */

import { useState, useEffect, useCallback } from 'react';
import { getStorageService } from '@/services/storage';
import { SaleService, type CreateSaleInput } from '@/services/SaleService';
import { InventoryService, type ServiceResult } from '@/services/InventoryService';
import type { Sale, SaleItem } from '@/types/sale';

export interface UseSalesReturn {
  sales: Sale[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  /** Registra una venta descontando stock de forma atómica. */
  registerSale: (input: CreateSaleInput) => Promise<ServiceResult<Sale>>;
}

export function useSales(): UseSalesReturn {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saleService, setSaleService] = useState<SaleService | null>(null);
  const [inventoryService, setInventoryService] = useState<InventoryService | null>(null);

  // Inicializa ambos servicios compartiendo el mismo StorageService.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storage = await getStorageService();
        if (!cancelled) {
          setSaleService(new SaleService(storage));
          setInventoryService(new InventoryService(storage));
        }
      } catch {
        if (!cancelled) {
          setError('Error al inicializar el servicio de ventas.');
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
    if (!saleService) return;
    setLoading(true);
    setError(null);
    try {
      const data = await saleService.getAll();
      setSales(data);
    } catch {
      setError('Error al cargar el historial de ventas.');
    } finally {
      setLoading(false);
    }
  }, [saleService]);

  useEffect(() => {
    if (saleService) refreshData();
  }, [saleService, refreshData]);

  const registerSale = useCallback(
    async (input: CreateSaleInput): Promise<ServiceResult<Sale>> => {
      if (!saleService || !inventoryService) {
        return { success: false, error: 'El servicio de ventas no está listo.' };
      }
      setError(null);

      // 1. Descuento de stock atómico (Req 8.2, 8.3). Los servicios (stock null)
      //    no descuentan; los productos validan stock suficiente.
      const saleItems: SaleItem[] = input.items.map((line) => ({
        inventoryId: line.inventoryId,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        subtotal: line.quantity * line.unitPrice,
      }));

      const stockResult = await inventoryService.applySale(saleItems);
      if (!stockResult.success) {
        setError(stockResult.error);
        return { success: false, error: stockResult.error };
      }

      // 2. Registrar la venta (genera comprobante y plan de crédito si aplica).
      const saleResult = await saleService.createSale(input);
      if (!saleResult.success) {
        setError(saleResult.error);
        // Nota: en un backend real esto sería una transacción; aquí el descuento
        // ya se aplicó. Se reporta el error para que la UI lo maneje.
        return saleResult;
      }

      await refreshData();
      return saleResult;
    },
    [saleService, inventoryService, refreshData],
  );

  return {
    sales,
    loading,
    error,
    refreshData,
    registerSale,
  };
}
