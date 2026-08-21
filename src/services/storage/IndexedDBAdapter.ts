/**
 * IndexedDBAdapter — Primary storage adapter using IndexedDB.
 *
 * Uses a single object store ("gymops") as a key-value store.
 * All values are stored as JSON-compatible objects.
 */

const DB_NAME = 'gymops-db';
const DB_VERSION = 1;
const STORE_NAME = 'gymops';

export interface StorageAdapter {
  init(): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * Detects whether IndexedDB is available and functional in the current environment.
 */
export async function isIndexedDBAvailable(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') {
      return false;
    }
    // Attempt to open a test database to verify it actually works
    // (some browsers have indexedDB defined but block it in certain contexts)
    return await new Promise<boolean>((resolve) => {
      const testName = '__idb_test__';
      const request = indexedDB.open(testName);
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase(testName);
        resolve(true);
      };
      request.onerror = () => {
        resolve(false);
      };
      // If blocked (e.g. private mode in some browsers)
      request.onblocked = () => {
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    return new Promise<T | null>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const value = request.result;
        resolve(value !== undefined ? (value as T) : null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get key "${key}" from IndexedDB`));
      };
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to set key "${key}" in IndexedDB`));
      };
    });
  }

  async delete(key: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete key "${key}" from IndexedDB`));
      };
    });
  }

  async keys(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };

      request.onerror = () => {
        reject(new Error('Failed to get keys from IndexedDB'));
      };
    });
  }
}
