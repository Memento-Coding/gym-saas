/**
 * ApiStorageAdapter — StorageAdapter respaldado por la API REST de GymOps.
 *
 * Implementa la interfaz StorageAdapter (get/set/delete/keys) que consumen todos
 * los servicios del frontend, pero en vez de IndexedDB/localStorage delega en
 * handlers REST por recurso. De esta forma NINGÚN servicio ni hook necesita
 * cambiar: siguen leyendo/escribiendo colecciones bajo su clave habitual y el
 * adaptador las traduce a llamadas HTTP + mapeo de shapes.
 *
 * Enrutamiento por clave:
 *   'students'            → StudentsResource        (/students)
 *   'payments'            → PaymentsResource         (/payments)
 *   'sales'               → SalesResource            (/sales)
 *   'inventory_items'     → InventoryResource        (/inventory)
 *   'finance_movements'   → FinanceResource          (/finance)
 *   'consent_config'      → ConsentResource          (/consent)
 *   'communication_config'→ CommunicationResource    (/communication)
 *   'branding' | 'costs' | 'gymops_costs_config' | 'formFields'
 *                         → SettingsResource         (/settings)  [objeto único]
 *
 * Claves sin recurso REST (p. ej. 'meta' para la secuencia local de comprobantes)
 * caen a un adaptador local de respaldo para no romper el flujo. En modo API el
 * backend asigna los números de comprobante reales; 'meta' solo cubre el camino
 * de generación optimista del cliente.
 */

import type { StorageAdapter } from '../storage/IndexedDBAdapter';
import type { ResourceHandler } from './resources/types';
import { StudentsResource } from './resources/studentsResource';
import { PaymentsResource } from './resources/paymentsResource';
import { SalesResource } from './resources/salesResource';
import { InventoryResource } from './resources/inventoryResource';
import { FinanceResource } from './resources/financeResource';
import { ConsentResource } from './resources/consentResource';
import { CommunicationResource } from './resources/communicationResource';
import { SettingsResource } from './resources/settingsResource';

/** Claves de configuración servidas por el recurso único /settings. */
const SETTINGS_KEYS = new Set(['branding', 'costs', 'gymops_costs_config', 'formFields']);

export class ApiStorageAdapter implements StorageAdapter {
  private handlers: Record<string, ResourceHandler>;
  /** Recurso de settings compartido por las claves de configuración. */
  private settings: SettingsResource;
  /** Respaldo local para claves sin recurso REST (p. ej. 'meta'). */
  private fallback: StorageAdapter;

  constructor(fallback: StorageAdapter) {
    this.fallback = fallback;
    this.settings = new SettingsResource();

    this.handlers = {
      students: new StudentsResource(),
      payments: new PaymentsResource(),
      sales: new SalesResource(),
      inventory_items: new InventoryResource(),
      finance_movements: new FinanceResource(),
      consent_config: new ConsentResource(),
      communication_config: new CommunicationResource(),
    };
  }

  async init(): Promise<void> {
    // El fallback local necesita inicializarse (IndexedDB/localStorage).
    await this.fallback.init();
  }

  private handlerFor(key: string): ResourceHandler | null {
    return this.handlers[key] ?? null;
  }

  async get<T>(key: string): Promise<T | null> {
    if (SETTINGS_KEYS.has(key)) {
      return this.settings.getKey<T>(key);
    }
    const handler = this.handlerFor(key);
    if (!handler) {
      return this.fallback.get<T>(key);
    }
    return handler.get<T>();
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (SETTINGS_KEYS.has(key)) {
      await this.settings.setKey(key, value);
      return;
    }
    const handler = this.handlerFor(key);
    if (!handler) {
      await this.fallback.set<T>(key, value);
      return;
    }
    await handler.set<T>(value);
  }

  async delete(key: string): Promise<void> {
    if (SETTINGS_KEYS.has(key)) {
      await this.settings.deleteKey(key);
      return;
    }
    const handler = this.handlerFor(key);
    if (!handler) {
      await this.fallback.delete(key);
      return;
    }
    await handler.remove();
  }

  async keys(): Promise<string[]> {
    // Las claves "conocidas" del dominio más las que existan en el fallback.
    const known = [...Object.keys(this.handlers), ...SETTINGS_KEYS];
    const local = await this.fallback.keys();
    return Array.from(new Set([...known, ...local]));
  }
}
