/**
 * Unit tests for StorageService using LocalStorageAdapter
 * (jsdom environment doesn't have real IndexedDB, so we test the localStorage path).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStorageService, resetStorageService } from './StorageService';
import type { StorageService } from './StorageService';

describe('StorageService (localStorage fallback)', () => {
  let storage: StorageService;

  beforeEach(async () => {
    localStorage.clear();
    resetStorageService();
    storage = await createStorageService();
  });

  afterEach(() => {
    localStorage.clear();
    resetStorageService();
  });

  it('should get null for a non-existent key', async () => {
    const result = await storage.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should set and get a string value', async () => {
    await storage.set('greeting', 'hello');
    const result = await storage.get<string>('greeting');
    expect(result).toBe('hello');
  });

  it('should set and get a complex object', async () => {
    const student = {
      id: 'stu-001',
      firstName: 'Carlos',
      lastName: 'Gomez',
      status: 'active',
      payments: [{ amount: 110000, date: '2024-01-15' }],
    };
    await storage.set('students:stu-001', student);
    const result = await storage.get<typeof student>('students:stu-001');
    expect(result).toEqual(student);
  });

  it('should delete a key', async () => {
    await storage.set('key1', 'value1');
    await storage.delete('key1');
    const result = await storage.get('key1');
    expect(result).toBeNull();
  });

  it('should return all keys', async () => {
    await storage.set('a', 1);
    await storage.set('b', 2);
    await storage.set('c', 3);
    const allKeys = await storage.keys();
    expect(allKeys.sort()).toEqual(['a', 'b', 'c']);
  });

  it('should export all data', async () => {
    await storage.set('students', [{ id: '1', name: 'Ana' }]);
    await storage.set('inventory', [{ id: 'p1', name: 'Guantes' }]);
    const exported = await storage.exportAll();
    expect(exported).toEqual({
      students: [{ id: '1', name: 'Ana' }],
      inventory: [{ id: 'p1', name: 'Guantes' }],
    });
  });

  it('should import all data replacing existing', async () => {
    await storage.set('old-key', 'old-value');
    const importData = {
      students: [{ id: '1', name: 'María' }],
      settings: { theme: 'dark' },
    };
    await storage.importAll(importData);

    const oldValue = await storage.get('old-key');
    expect(oldValue).toBeNull();

    const students = await storage.get('students');
    expect(students).toEqual([{ id: '1', name: 'María' }]);

    const settings = await storage.get('settings');
    expect(settings).toEqual({ theme: 'dark' });
  });

  it('should clear all data', async () => {
    await storage.set('a', 1);
    await storage.set('b', 2);
    await storage.clear();
    const allKeys = await storage.keys();
    expect(allKeys).toEqual([]);
  });

  it('should clear data while preserving specified keys', async () => {
    await storage.set('students', []);
    await storage.set('costs', { plans: [] });
    await storage.set('consent', { version: 1 });
    await storage.set('inventory', []);

    await storage.clear(['costs', 'consent']);

    const costs = await storage.get('costs');
    const consent = await storage.get('consent');
    const students = await storage.get('students');
    const inventory = await storage.get('inventory');

    expect(costs).toEqual({ plans: [] });
    expect(consent).toEqual({ version: 1 });
    expect(students).toBeNull();
    expect(inventory).toBeNull();
  });

  it('should overwrite existing values on set', async () => {
    await storage.set('counter', 1);
    await storage.set('counter', 42);
    const result = await storage.get<number>('counter');
    expect(result).toBe(42);
  });

  it('should handle arrays correctly', async () => {
    const items = [1, 2, 3, 4, 5];
    await storage.set('numbers', items);
    const result = await storage.get<number[]>('numbers');
    expect(result).toEqual(items);
  });

  it('should handle nested objects', async () => {
    const nested = {
      level1: {
        level2: {
          level3: { value: 'deep' },
        },
      },
    };
    await storage.set('nested', nested);
    const result = await storage.get<typeof nested>('nested');
    expect(result).toEqual(nested);
  });
});
