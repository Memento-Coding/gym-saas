/**
 * FinanceService — Gestión de movimientos financieros de la academia.
 *
 * Responsabilidades:
 * - CRUD de movimientos financieros (ingresos, egresos, traslados)
 * - Categorización: ingresos, egresos, traslados
 * - Sub-categorías: pagos de membresía, ventas, inventario, cartera, precios
 * - Traslados balanceados entre cajas (servicios/almacén) y entre medios de pago:
 *   cada traslado genera un débito (expense) y un crédito (income) de igual monto,
 *   con efecto neto cero sobre el balance global
 * - Cálculo de balance (ingresos - egresos), donde los traslados son neutros
 * - Filtrado por mes y por caja
 * - Vinculación de movimientos a estudiantes
 * - Resumen con totales de ingresos, egresos y balance por período
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import type { StorageService } from '@/services/storage/StorageService';
import type { FinanceMovement } from '@/types/finance';
import type { PaymentMethod } from '@/types/payment';

/** Storage key for finance movements */
const FINANCE_KEY = 'finance_movements';

/** Caja: unidad contable donde se registran los movimientos */
export type FinanceBox = 'servicios' | 'almacen';

/** Payload para crear un ingreso o egreso simple */
export interface CreateMovementInput {
  type: 'income' | 'expense';
  date: string;
  concept: string;
  category: string;
  amount: number;
  box: FinanceBox;
  method?: PaymentMethod;
  studentId?: string;
  inventoryItemId?: string;
}

/** Payload para un traslado entre cajas o medios de pago */
export interface TransferInput {
  date: string;
  concept?: string;
  amount: number;
  /** Caja de origen (de donde sale el dinero) */
  fromBox: FinanceBox;
  /** Caja de destino (a donde entra el dinero) */
  toBox: FinanceBox;
  /** Medio de pago de origen (opcional, para traslados entre medios) */
  fromMethod?: PaymentMethod;
  /** Medio de pago de destino (opcional, para traslados entre medios) */
  toMethod?: PaymentMethod;
}

/** Resumen financiero de un conjunto de movimientos */
export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

/** Criterios de filtrado */
export interface FinanceFilter {
  /** Mes en formato 'YYYY-MM' */
  month?: string;
  /** Caja */
  box?: FinanceBox;
}

/**
 * Genera un identificador único para un movimiento.
 * Usa crypto.randomUUID cuando está disponible, con fallback determinista.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Extrae el mes ('YYYY-MM') de una fecha ISO.
 * Toma los primeros 7 caracteres para evitar corrimientos por zona horaria.
 */
function getMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export class FinanceService {
  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /**
   * Retorna todos los movimientos financieros almacenados.
   */
  async getAll(): Promise<FinanceMovement[]> {
    const movements = await this.storageService.get<FinanceMovement[]>(FINANCE_KEY);
    return movements ?? [];
  }

  /**
   * Retorna un movimiento por su id, o null si no existe.
   */
  async getById(id: string): Promise<FinanceMovement | null> {
    const movements = await this.getAll();
    return movements.find((m) => m.id === id) ?? null;
  }

  /**
   * Crea un movimiento simple de ingreso o egreso.
   *
   * Requirement 7.1: Categorización en ingresos y egresos
   * Requirement 7.6: Permite vincular a un estudiante (studentId)
   */
  async create(input: CreateMovementInput): Promise<FinanceMovement> {
    const movement: FinanceMovement = {
      id: generateId(),
      type: input.type,
      date: input.date,
      concept: input.concept,
      category: input.category,
      amount: input.amount,
      box: input.box,
      method: input.method,
      studentId: input.studentId,
      inventoryItemId: input.inventoryItemId,
    };

    const movements = await this.getAll();
    movements.push(movement);
    await this.storageService.set<FinanceMovement[]>(FINANCE_KEY, movements);

    return movement;
  }

  /**
   * Actualiza un movimiento existente por su id.
   * Retorna el movimiento actualizado o null si no se encontró.
   */
  async update(
    id: string,
    changes: Partial<Omit<FinanceMovement, 'id'>>,
  ): Promise<FinanceMovement | null> {
    const movements = await this.getAll();
    const index = movements.findIndex((m) => m.id === id);
    if (index === -1) {
      return null;
    }

    const updated: FinanceMovement = { ...movements[index], ...changes, id };
    movements[index] = updated;
    await this.storageService.set<FinanceMovement[]>(FINANCE_KEY, movements);

    return updated;
  }

  /**
   * Elimina un movimiento por su id.
   * Retorna true si se eliminó, false si no existía.
   */
  async delete(id: string): Promise<boolean> {
    const movements = await this.getAll();
    const filtered = movements.filter((m) => m.id !== id);
    if (filtered.length === movements.length) {
      return false;
    }
    await this.storageService.set<FinanceMovement[]>(FINANCE_KEY, filtered);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Traslados
  // ---------------------------------------------------------------------------

  /**
   * Registra un traslado entre cajas (servicios/almacén) o entre medios de pago.
   *
   * Un traslado se materializa como DOS movimientos asociados de igual monto:
   * - un débito (type: 'expense') en la caja/medio de origen
   * - un crédito (type: 'income') en la caja/medio de destino
   *
   * Ambos movimientos se marcan con type='transfer' en su lógica de balance:
   * el débito lleva type 'expense' y el crédito type 'income', pero se vinculan
   * mediante `transferTo` para que el efecto neto sobre el balance global sea cero.
   *
   * Para mantener la invariante de balance (Property 17/19), los movimientos de
   * traslado se registran con type 'transfer' y NO alteran el balance calculado.
   *
   * Requirement 7.3: Traslados entre medios de pago y entre cajas
   *
   * @returns Los dos movimientos creados: [débito, crédito]
   */
  async transfer(input: TransferInput): Promise<[FinanceMovement, FinanceMovement]> {
    if (input.amount <= 0) {
      throw new Error('El monto del traslado debe ser mayor que cero.');
    }

    const debitId = generateId();
    const creditId = generateId();

    const fromLabel = input.fromMethod ? `${input.fromBox}/${input.fromMethod}` : input.fromBox;
    const toLabel = input.toMethod ? `${input.toBox}/${input.toMethod}` : input.toBox;
    const concept = input.concept ?? `Traslado ${fromLabel} → ${toLabel}`;

    // Débito: sale de la caja/medio de origen
    const debit: FinanceMovement = {
      id: debitId,
      type: 'transfer',
      date: input.date,
      concept,
      category: 'Traslado',
      amount: input.amount,
      box: input.fromBox,
      method: input.fromMethod,
      transferTo: creditId,
    };

    // Crédito: entra a la caja/medio de destino
    const credit: FinanceMovement = {
      id: creditId,
      type: 'transfer',
      date: input.date,
      concept,
      category: 'Traslado',
      amount: input.amount,
      box: input.toBox,
      method: input.toMethod,
      transferTo: debitId,
    };

    const movements = await this.getAll();
    movements.push(debit, credit);
    await this.storageService.set<FinanceMovement[]>(FINANCE_KEY, movements);

    return [debit, credit];
  }

  // ---------------------------------------------------------------------------
  // Balance y resumen
  // ---------------------------------------------------------------------------

  /**
   * Calcula el balance de una lista de movimientos:
   * balance = sum(ingresos) - sum(egresos).
   * Los traslados (type 'transfer') NO afectan el balance.
   *
   * Requirement 7.7: Balance = ingresos - egresos
   */
  static computeBalance(movements: FinanceMovement[]): number {
    return movements.reduce((acc, m) => {
      if (m.type === 'income') return acc + m.amount;
      if (m.type === 'expense') return acc - m.amount;
      return acc; // transfer: neutro
    }, 0);
  }

  /**
   * Calcula un resumen (totales de ingresos, egresos y balance) de una lista.
   * Los traslados no cuentan como ingresos ni egresos.
   *
   * Requirement 7.7: Resumen con totales de ingresos, egresos y balance
   */
  static computeSummary(movements: FinanceMovement[]): FinanceSummary {
    let totalIncome = 0;
    let totalExpense = 0;
    for (const m of movements) {
      if (m.type === 'income') totalIncome += m.amount;
      else if (m.type === 'expense') totalExpense += m.amount;
    }
    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }

  /**
   * Retorna el balance global de todos los movimientos almacenados.
   */
  async getBalance(): Promise<number> {
    const movements = await this.getAll();
    return FinanceService.computeBalance(movements);
  }

  /**
   * Retorna el resumen (ingresos, egresos, balance) opcionalmente filtrado.
   */
  async getSummary(filter?: FinanceFilter): Promise<FinanceSummary> {
    const movements = filter ? await this.filter(filter) : await this.getAll();
    return FinanceService.computeSummary(movements);
  }

  // ---------------------------------------------------------------------------
  // Filtrado
  // ---------------------------------------------------------------------------

  /**
   * Filtra una lista de movimientos por mes ('YYYY-MM') y/o caja.
   * Función pura reutilizable para pruebas y UI.
   *
   * Requirement 7.5: Filtrar por mes y por caja
   */
  static applyFilter(movements: FinanceMovement[], filter: FinanceFilter): FinanceMovement[] {
    return movements.filter((m) => {
      if (filter.month !== undefined && getMonthKey(m.date) !== filter.month) {
        return false;
      }
      if (filter.box !== undefined && m.box !== filter.box) {
        return false;
      }
      return true;
    });
  }

  /**
   * Retorna los movimientos almacenados que satisfacen el filtro dado.
   *
   * Requirement 7.5: Filtrar por mes y por caja
   */
  async filter(filter: FinanceFilter): Promise<FinanceMovement[]> {
    const movements = await this.getAll();
    return FinanceService.applyFilter(movements, filter);
  }

  /**
   * Retorna los movimientos vinculados a un estudiante específico.
   *
   * Requirement 7.6: Vinculación de movimientos a estudiantes
   */
  async getByStudent(studentId: string): Promise<FinanceMovement[]> {
    const movements = await this.getAll();
    return movements.filter((m) => m.studentId === studentId);
  }
}
