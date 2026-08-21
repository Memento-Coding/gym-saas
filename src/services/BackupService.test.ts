import { describe, it, expect, beforeEach } from 'vitest';
import {
  BackupService,
  validateBackupSchema,
  getBackupFileName,
  formatReceiptNumber,
} from './BackupService';
import type { StorageService } from '@/services/storage/StorageService';

/**
 * In-memory mock of StorageService for testing.
 */
function createMockStorage(): StorageService {
  const store = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async keys(): Promise<string[]> {
      return Array.from(store.keys());
    },
    async exportAll(): Promise<Record<string, unknown>> {
      const result: Record<string, unknown> = {};
      for (const [key, value] of store.entries()) {
        result[key] = value;
      }
      return result;
    },
    async importAll(data: Record<string, unknown>): Promise<void> {
      store.clear();
      for (const [key, value] of Object.entries(data)) {
        store.set(key, value);
      }
    },
    async clear(preserveKeys?: string[]): Promise<void> {
      if (preserveKeys) {
        const preserved = new Map<string, unknown>();
        for (const key of preserveKeys) {
          if (store.has(key)) {
            preserved.set(key, store.get(key));
          }
        }
        store.clear();
        for (const [key, value] of preserved.entries()) {
          store.set(key, value);
        }
      } else {
        store.clear();
      }
    },
  };
}

describe('BackupService', () => {
  let storage: StorageService;
  let backupService: BackupService;

  beforeEach(() => {
    storage = createMockStorage();
    backupService = new BackupService(storage);
  });

  describe('exportAll', () => {
    it('returns all data from storage with correct filename format', async () => {
      await storage.set('students', [{ id: '1', name: 'Test' }]);
      await storage.set('meta', { seq: 5 });

      const { data, fileName } = await backupService.exportAll();

      expect(data).toHaveProperty('students');
      expect(data).toHaveProperty('meta');
      expect(fileName).toMatch(/^gymops_backup_\d{4}-\d{2}-\d{2}\.json$/);
    });

    it('generates filename with current date', async () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      const { fileName } = await backupService.exportAll();

      expect(fileName).toBe(`gymops_backup_${year}-${month}-${day}.json`);
    });
  });

  describe('importAll', () => {
    it('imports valid backup data successfully', async () => {
      const validBackup = {
        students: [{ id: '1', name: 'Ana' }],
        costs: { plans: [] },
        consent: { version: 1 },
        finance: [],
        inventory: [],
        sales: [],
        meta: { seq: 10 },
      };

      const result = await backupService.importAll(validBackup);

      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();

      // Verify data was persisted
      const students = await storage.get('students');
      expect(students).toEqual([{ id: '1', name: 'Ana' }]);
    });

    it('rejects null data without modifying storage', async () => {
      await storage.set('students', [{ id: 'existing' }]);

      const result = await backupService.importAll(null);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);

      // Verify existing data is preserved
      const students = await storage.get('students');
      expect(students).toEqual([{ id: 'existing' }]);
    });

    it('rejects backup missing required keys without modifying storage', async () => {
      await storage.set('students', [{ id: 'original' }]);

      const invalidBackup = {
        students: [],
        costs: {},
        // missing: consent, finance, inventory, sales, meta
      };

      const result = await backupService.importAll(invalidBackup);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Falta la key requerida: "consent".');

      // Verify storage unchanged
      const students = await storage.get('students');
      expect(students).toEqual([{ id: 'original' }]);
    });

    it('rejects backup with wrong types', async () => {
      const invalidBackup = {
        students: 'not an array',
        costs: {},
        consent: {},
        finance: [],
        inventory: [],
        sales: [],
        meta: { seq: 5 },
      };

      const result = await backupService.importAll(invalidBackup);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('La key "students" debe ser un array.');
    });

    it('rejects backup with invalid meta.seq', async () => {
      const invalidBackup = {
        students: [],
        costs: {},
        consent: {},
        finance: [],
        inventory: [],
        sales: [],
        meta: { seq: -1 },
      };

      const result = await backupService.importAll(invalidBackup);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('La key "meta.seq" debe ser un entero no negativo.');
    });
  });

  describe('getNextReceiptNumber', () => {
    it('returns GOP-0001 on first call', async () => {
      const receipt = await backupService.getNextReceiptNumber();
      expect(receipt).toBe('GOP-0001');
    });

    it('increments sequentially', async () => {
      const r1 = await backupService.getNextReceiptNumber();
      const r2 = await backupService.getNextReceiptNumber();
      const r3 = await backupService.getNextReceiptNumber();

      expect(r1).toBe('GOP-0001');
      expect(r2).toBe('GOP-0002');
      expect(r3).toBe('GOP-0003');
    });

    it('continues from existing seq in storage', async () => {
      await storage.set('meta', { seq: 42 });

      const receipt = await backupService.getNextReceiptNumber();
      expect(receipt).toBe('GOP-0043');
    });

    it('persists the incremented seq', async () => {
      await backupService.getNextReceiptNumber();
      await backupService.getNextReceiptNumber();

      const currentSeq = await backupService.getCurrentSeq();
      expect(currentSeq).toBe(2);
    });

    it('zero-pads to 4 digits', async () => {
      await storage.set('meta', { seq: 9 });
      const receipt = await backupService.getNextReceiptNumber();
      expect(receipt).toBe('GOP-0010');
    });
  });

  describe('getCurrentSeq', () => {
    it('returns 0 when no meta exists', async () => {
      const seq = await backupService.getCurrentSeq();
      expect(seq).toBe(0);
    });

    it('returns current seq from storage', async () => {
      await storage.set('meta', { seq: 15 });
      const seq = await backupService.getCurrentSeq();
      expect(seq).toBe(15);
    });
  });
});

describe('validateBackupSchema', () => {
  it('validates a correct backup', () => {
    const result = validateBackupSchema({
      students: [],
      costs: {},
      consent: {},
      finance: [],
      inventory: [],
      sales: [],
      meta: { seq: 0 },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-object input', () => {
    expect(validateBackupSchema('string')).toEqual({
      valid: false,
      errors: ['El archivo de backup debe ser un objeto JSON válido.'],
    });
    expect(validateBackupSchema(42)).toEqual({
      valid: false,
      errors: ['El archivo de backup debe ser un objeto JSON válido.'],
    });
    expect(validateBackupSchema([])).toEqual({
      valid: false,
      errors: ['El archivo de backup debe ser un objeto JSON válido.'],
    });
  });

  it('rejects null/undefined', () => {
    expect(validateBackupSchema(null).valid).toBe(false);
    expect(validateBackupSchema(undefined).valid).toBe(false);
  });

  it('reports all missing keys', () => {
    const result = validateBackupSchema({});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(7);
  });

  it('rejects non-integer seq', () => {
    const result = validateBackupSchema({
      students: [],
      costs: {},
      consent: {},
      finance: [],
      inventory: [],
      sales: [],
      meta: { seq: 3.5 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('La key "meta.seq" debe ser un entero no negativo.');
  });
});

describe('getBackupFileName', () => {
  it('formats date correctly', () => {
    const date = new Date(2025, 0, 15); // Jan 15, 2025
    expect(getBackupFileName(date)).toBe('gymops_backup_2025-01-15.json');
  });

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2025, 2, 5); // Mar 5, 2025
    expect(getBackupFileName(date)).toBe('gymops_backup_2025-03-05.json');
  });
});

describe('formatReceiptNumber', () => {
  it('formats as GOP-XXXX', () => {
    expect(formatReceiptNumber(1)).toBe('GOP-0001');
    expect(formatReceiptNumber(42)).toBe('GOP-0042');
    expect(formatReceiptNumber(999)).toBe('GOP-0999');
    expect(formatReceiptNumber(1000)).toBe('GOP-1000');
    expect(formatReceiptNumber(9999)).toBe('GOP-9999');
  });

  it('handles numbers larger than 4 digits', () => {
    expect(formatReceiptNumber(10000)).toBe('GOP-10000');
  });
});
