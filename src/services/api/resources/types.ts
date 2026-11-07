/**
 * types — Contrato de un ResourceHandler del ApiAdapter.
 *
 * El StorageService trata todo como pares clave→valor. El ApiAdapter enruta cada
 * clave conocida (p. ej. 'students', 'payments', 'settings') a un ResourceHandler
 * que traduce esas operaciones clave-valor en llamadas REST + mapeo de shapes.
 *
 * Contrato:
 *  - get(): devuelve el valor que el servicio del frontend espera bajo esa clave
 *    (normalmente un array de entidades, o un objeto de configuración).
 *  - set(value): sincroniza el estado deseado contra la API. Para colecciones
 *    esto implica un diff (create/update/delete) contra el estado remoto.
 *  - remove(): limpia el recurso (raramente usado; la mayoría solo lee/escribe).
 */

export interface ResourceHandler {
  /** Lee el recurso y lo devuelve en la forma que espera el servicio del frontend. */
  get<T>(): Promise<T | null>;
  /** Sincroniza el valor deseado contra la API. */
  set<T>(value: T): Promise<void>;
  /** Elimina/limpia el recurso (opcional en la práctica). */
  remove(): Promise<void>;
}
