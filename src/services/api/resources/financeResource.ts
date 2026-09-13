/**
 * financeResource — Handler REST para la clave 'finance_movements' (/finance).
 *
 * Los movimientos financieros son, en la práctica, un libro append-only: se
 * crean (ingresos/egresos/traslados) pero rara vez se editan/borran. Habilitamos
 * update/delete de forma conservadora; si la API no los soporta, devolverá un
 * error que el servicio propaga.
 *
 * @see gym-sass-infra/docs/DATA-MODEL.md — finance
 */

import { CollectionResource } from './collectionResource';
import type { FinanceMovement } from '@/types/finance';
import {
  apiToFinance,
  financeToApi,
  type ApiFinanceMovement,
} from '../mappers/financeMapper';

export class FinanceResource extends CollectionResource<FinanceMovement, ApiFinanceMovement> {
  constructor() {
    super({
      listPath: '/finance',
      itemPath: (id) => `/finance/${encodeURIComponent(id)}`,
      apiToFront: apiToFinance,
      frontToApi: financeToApi,
      idOf: (item) => item.id,
    });
  }
}
