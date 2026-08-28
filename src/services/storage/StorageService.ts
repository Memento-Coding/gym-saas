/**
 * StorageService — Interfaz unificada de persistencia y factory.
 *
 * Abstrae el mecanismo de almacenamiento subyacente (IndexedDB, localStorage, API).
 * Implementa dual-write (IndexedDB + localStorage) cuando IndexedDB está disponible,
 * con fallback transparente a localStorage si no lo está.
 *
 * En modo E2E (VITE_E2E_STORAGE=localStorage), usa exclusivamente localStorage
 * para que los tests de Playwright puedan sembrar datos de forma determinista.
 */

import { IndexedDBAdapter, isIndexedDBAvailable } from './IndexedDBAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import type { StorageAdapter } from './IndexedDBAdapter';

export interface StorageService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  exportAll(): Promise<Record<string, unknown>>;
  importAll(data: Record<string, unknown>): Promise<void>;
  clear(preserveKeys?: string[]): Promise<void>;
}

/**
 * Implementation that wraps one or two StorageAdapters into the unified StorageService.
 */
class StorageServiceImpl implements StorageService {
  private primary: StorageAdapter;
  private secondary: StorageAdapter | null;

  constructor(primary: StorageAdapter, secondary: StorageAdapter | null) {
    this.primary = primary;
    this.secondary = secondary;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.primary.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.primary.set(key, value);
    if (this.secondary) {
      await this.secondary.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    await this.primary.delete(key);
    if (this.secondary) {
      await this.secondary.delete(key);
    }
  }

  async keys(): Promise<string[]> {
    return this.primary.keys();
  }

  async exportAll(): Promise<Record<string, unknown>> {
    const allKeys = await this.keys();
    const result: Record<string, unknown> = {};
    for (const key of allKeys) {
      result[key] = await this.primary.get(key);
    }
    return result;
  }

  async importAll(data: Record<string, unknown>): Promise<void> {
    // Clear existing data first
    const existingKeys = await this.keys();
    for (const key of existingKeys) {
      await this.primary.delete(key);
      if (this.secondary) {
        await this.secondary.delete(key);
      }
    }
    // Import all new data
    for (const [key, value] of Object.entries(data)) {
      await this.primary.set(key, value);
      if (this.secondary) {
        await this.secondary.set(key, value);
      }
    }
  }

  async clear(preserveKeys?: string[]): Promise<void> {
    const allKeys = await this.keys();
    const keysToDelete = preserveKeys
      ? allKeys.filter((k) => !preserveKeys.includes(k))
      : allKeys;

    for (const key of keysToDelete) {
      await this.primary.delete(key);
      if (this.secondary) {
        await this.secondary.delete(key);
      }
    }
  }
}

/** Singleton instance */
let instance: StorageService | null = null;

/**
 * Creates and initializes the StorageService singleton.
 * Uses IndexedDB as primary with localStorage as secondary (dual-write).
 * Falls back to localStorage-only if IndexedDB is unavailable.
 *
 * In E2E mode (VITE_E2E_STORAGE=localStorage), uses localStorage only.
 */
export async function createStorageService(): Promise<StorageService> {
  if (instance) return instance;

  const localAdapter = new LocalStorageAdapter();
  await localAdapter.init();

  // E2E mode: use localStorage only for deterministic test data seeding
  const useLocalStorageOnly = import.meta.env.VITE_E2E_STORAGE === 'localStorage';

  if (useLocalStorageOnly) {
    instance = new StorageServiceImpl(localAdapter, null);
    return instance;
  }

  const idbAvailable = await isIndexedDBAvailable();

  if (idbAvailable) {
    const idbAdapter = new IndexedDBAdapter();
    await idbAdapter.init();
    instance = new StorageServiceImpl(idbAdapter, localAdapter);
  } else {
    instance = new StorageServiceImpl(localAdapter, null);
  }

  return instance;
}

/**
 * Returns the existing StorageService singleton, or creates it if needed.
 */
export async function getStorageService(): Promise<StorageService> {
  if (instance) return instance;
  return createStorageService();
}

/**
 * Resets the singleton (used for testing).
 */
export function resetStorageService(): void {
  instance = null;
}
