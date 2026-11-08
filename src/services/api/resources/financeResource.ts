/**
 * financeResource — Handler REST para la clave 'finance_movements'.
 *
 * La API es un libro append-only: GET/POST /finance/movements y POST
 * /finance/transfers; no permite editar ni borrar movimientos.
 *
 * @see gym-sass-infra/docs/DATA-MODEL.md — finance
 */

import { api } from '../apiClient';
import { CollectionResource } from './collectionResource';
import type { FinanceMovement } from '@/types/finance';
import {
  apiToFinance,
  financeToApi,
  type ApiFinanceMovement,
} from '../mappers/financeMapper';

const LIST_PATH = '/finance/movements';

export class FinanceResource extends CollectionResource<FinanceMovement, ApiFinanceMovement> {
  constructor() {
    super({
      listPath: LIST_PATH,
      itemPath: (id) => `${LIST_PATH}/${encodeURIComponent(id)}`,
      apiToFront: apiToFinance,
      frontToApi: financeToApi,
      idOf: (item) => item.id,
      canUpdate: false,
      canDelete: false,
    });
  }

  /** Publica solo lo nuevo; un traslado (dos patas en el front) es un único POST. */
  async set<T>(value: T): Promise<void> {
    const desired = (Array.isArray(value) ? value : []) as FinanceMovement[];
    const remote = await api.get<ApiFinanceMovement[]>(LIST_PATH);
    const remoteIds = new Set((Array.isArray(remote) ? remote : []).map((m) => m.id));
    const fresh = desired.filter((m) => !remoteIds.has(m.id));
    const destinationLegs = new Set<string>();

    for (const m of fresh) {
      if (m.type !== 'transfer') {
        await api.post(LIST_PATH, financeToApi(m));
        continue;
      }
      if (destinationLegs.has(m.id)) continue;
      // FinanceService.transfer agrega primero la pata de origen.
      const destination = fresh.find((d) => d.id === m.transferTo);
      if (!destination) throw new Error('Traslado incompleto: falta la cuenta de destino.');
      destinationLegs.add(destination.id);
      await api.post('/finance/transfers', {
        fromAccount: m.box,
        toAccount: destination.box,
        amount: m.amount,
        method: m.method,
        note: m.concept,
      });
    }
  }
}
