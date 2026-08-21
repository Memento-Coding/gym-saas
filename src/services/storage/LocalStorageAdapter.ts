/**
 * LocalStorageAdapter — Fallback storage adapter using localStorage.
 *
 * Used as:
 * 1. The secondary (dual-write) adapter when IndexedDB is available.
 * 2. The primary adapter when IndexedDB is NOT available.
 *
 * All values are JSON-serialized. Keys are stored under a namespace prefix
 * to avoid collisions with other apps sharing localStorage.
 */

import type { StorageAdapter } from './IndexedDBAdapter';

const KEY_PREFIX = 'gymops:';

export class LocalStorageAdapter implements StorageAdapter {
  async init(): Promise<void> {
    // localStorage is synchronous and always available if the code reaches here.
    // No initialization needed.
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(KEY_PREFIX + key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(KEY_PREFIX + key, serialized);
    } catch (error) {
      // localStorage might throw if storage quota is exceeded
      console.error(`LocalStorageAdapter: Failed to set key "${key}"`, error);
      throw new Error(`Failed to set key "${key}" in localStorage`);
    }
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(KEY_PREFIX + key);
  }

  async keys(): Promise<string[]> {
    const result: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(KEY_PREFIX)) {
        result.push(fullKey.slice(KEY_PREFIX.length));
      }
    }
    return result;
  }
}
