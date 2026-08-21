/**
 * BackupService — Exportación/importación de datos y gestión de secuencia de comprobantes.
 *
 * Responsabilidades:
 * - Exportar todos los datos de la aplicación a un archivo JSON descargable
 * - Importar datos desde un archivo JSON con validación de estructura
 * - Gestionar el número de secuencia (seq) para comprobantes GOP-XXXX
 *
 * Requirements: 2.4, 2.5, 2.7
 */

import type { StorageService } from '@/services/storage/StorageService';
import type { AppMeta } from '@/types/settings';

/** Keys requeridas en un backup válido */
const REQUIRED_BACKUP_KEYS = [
  'students',
  'costs',
  'consent',
  'finance',
  'inventory',
  'sales',
  'meta',
] as const;

/** Resultado de la validación de un backup */
export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida la estructura de un objeto JSON de backup.
 * Verifica que las keys requeridas existan y tengan los tipos correctos.
 */
export function validateBackupSchema(data: unknown): BackupValidationResult {
  const errors: string[] = [];

  if (data === null || data === undefined) {
    return { valid: false, errors: ['El archivo de backup está vacío o es nulo.'] };
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['El archivo de backup debe ser un objeto JSON válido.'] };
  }

  const record = data as Record<string, unknown>;

  // Verificar keys requeridas
  for (const key of REQUIRED_BACKUP_KEYS) {
    if (!(key in record)) {
      errors.push(`Falta la key requerida: "${key}".`);
    }
  }

  // Si faltan keys, retornar temprano
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Verificar tipos correctos para cada key
  if (!Array.isArray(record.students)) {
    errors.push('La key "students" debe ser un array.');
  }

  if (typeof record.costs !== 'object' || record.costs === null || Array.isArray(record.costs)) {
    errors.push('La key "costs" debe ser un objeto.');
  }

  if (typeof record.consent !== 'object' || record.consent === null || Array.isArray(record.consent)) {
    errors.push('La key "consent" debe ser un objeto.');
  }

  if (!Array.isArray(record.finance)) {
    errors.push('La key "finance" debe ser un array.');
  }

  if (!Array.isArray(record.inventory)) {
    errors.push('La key "inventory" debe ser un array.');
  }

  if (!Array.isArray(record.sales)) {
    errors.push('La key "sales" debe ser un array.');
  }

  if (typeof record.meta !== 'object' || record.meta === null || Array.isArray(record.meta)) {
    errors.push('La key "meta" debe ser un objeto.');
  } else {
    const meta = record.meta as Record<string, unknown>;
    if (typeof meta.seq !== 'number' || !Number.isInteger(meta.seq) || meta.seq < 0) {
      errors.push('La key "meta.seq" debe ser un entero no negativo.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Formatea la fecha actual como YYYY-MM-DD.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Genera el nombre del archivo de backup con la fecha actual.
 */
export function getBackupFileName(date: Date = new Date()): string {
  return `gymops_backup_${formatDate(date)}.json`;
}

/**
 * Formatea un número de secuencia como comprobante GOP-XXXX.
 */
export function formatReceiptNumber(seq: number): string {
  return `GOP-${String(seq).padStart(4, '0')}`;
}

/** Clave de almacenamiento para los metadatos de la app */
const META_KEY = 'meta';

export class BackupService {
  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  /**
   * Exporta todos los datos de la aplicación como un archivo JSON descargable.
   * El archivo se genera con el nombre `gymops_backup_YYYY-MM-DD.json`.
   */
  async exportAll(): Promise<{ data: Record<string, unknown>; fileName: string }> {
    const data = await this.storageService.exportAll();
    const fileName = getBackupFileName();
    return { data, fileName };
  }

  /**
   * Descarga el backup como archivo JSON en el navegador.
   */
  async downloadBackup(): Promise<void> {
    const { data, fileName } = await this.exportAll();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Importa datos desde un objeto JSON validando la estructura primero.
   * Si la validación falla, NO modifica el estado actual.
   *
   * @returns Resultado con éxito o errores de validación
   */
  async importAll(data: unknown): Promise<{ success: boolean; errors?: string[] }> {
    const validation = validateBackupSchema(data);

    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // La validación pasó — sobrescribir los datos
    await this.storageService.importAll(data as Record<string, unknown>);
    return { success: true };
  }

  /**
   * Obtiene el siguiente número de comprobante y lo incrementa.
   * Formato: GOP-0001, GOP-0002, etc.
   */
  async getNextReceiptNumber(): Promise<string> {
    const meta = await this.storageService.get<AppMeta>(META_KEY);
    const currentSeq = meta?.seq ?? 0;
    const nextSeq = currentSeq + 1;

    // Persistir el nuevo seq
    await this.storageService.set<AppMeta>(META_KEY, { ...meta, seq: nextSeq });

    return formatReceiptNumber(nextSeq);
  }

  /**
   * Obtiene el número de secuencia actual sin incrementarlo.
   */
  async getCurrentSeq(): Promise<number> {
    const meta = await this.storageService.get<AppMeta>(META_KEY);
    return meta?.seq ?? 0;
  }
}
