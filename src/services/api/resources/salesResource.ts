/**
 * salesResource — Handler REST para la clave 'sales' (/sales).
 *
 * Lectura: GET /sales → Sale[] del frontend.
 *
 * Escritura: la creación de una venta en la API es transaccional (descuenta
 * stock e ingresa el movimiento financiero atómicamente vía TransactWriteItems),
 * y el backend asigna id y receiptNo. Por eso set() no hace diff-sync; la
 * creación real se hace con createApiSale(). El pago de cuotas usa payInstallment.
 *
 * @see gym-sass-infra/docs/API.md — Sales Lambda
 */

import { api } from '../apiClient';
import type { ResourceHandler } from './types';
import type { Sale } from '@/types/sale';
import { apiToSale, saleToApi, type ApiSale } from '../mappers/saleMapper';

/** Crea una venta real en la API (transaccional). Devuelve la venta mapeada. */
export async function createApiSale(sale: Sale): Promise<Sale> {
  const created = await api.post<ApiSale>('/sales', saleToApi(sale));
  return apiToSale(created);
}

/** Registra el pago de una cuota de crédito de una venta. */
export async function payApiInstallment(
  saleId: string,
  installmentNumber: number,
  amount: number,
  method: string,
): Promise<Sale> {
  const updated = await api.post<ApiSale>(
    `/sales/${encodeURIComponent(saleId)}/installments`,
    { installmentNumber, amount, method },
  );
  return apiToSale(updated);
}

export class SalesResource implements ResourceHandler {
  async get<T>(): Promise<T | null> {
    const sales = await api.get<ApiSale[]>('/sales');
    const list = Array.isArray(sales) ? sales : [];
    return list.map((s) => apiToSale(s)) as T;
  }

  async set<T>(_value: T): Promise<void> {
    // La creación de ventas es transaccional en la API; se usa createApiSale().
    void _value;
  }

  async remove(): Promise<void> {
    // La API no expone borrado masivo de ventas; no-op.
  }
}
