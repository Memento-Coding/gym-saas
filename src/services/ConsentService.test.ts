import { describe, it, expect, beforeEach } from 'vitest';
import { ConsentService } from './ConsentService';
import type { StorageService } from '@/services/storage/StorageService';
import type { Student } from '@/types/student';
import type { ConsentConfig } from '@/types/consent';

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

function createTestStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'student-1',
    photo: '',
    firstName: 'Juan',
    lastName: 'Pérez',
    documentId: '123456',
    isMinor: false,
    guardianName: '',
    guardianDocument: '',
    phone: '3001234567',
    email: 'juan@test.com',
    emergencyName: 'María',
    emergencyPhone: '3009876543',
    emergencyRelation: 'Madre',
    dateOfBirth: '1990-05-15',
    bloodType: 'O+',
    firstRegistrationDate: '2024-01-01',
    recentRegistrationDate: '2024-01-01',
    registrationDate: '2024-01-01',
    subscriptionEndDate: '2024-02-01',
    monthlyFee: 80000,
    planCategory: 'mensualidad',
    planName: 'Plan Básico',
    planId: 'plan-1',
    payments: [],
    courtesyBonuses: [],
    medicalNotes: '',
    status: 'active',
    beltRank: 'blanca',
    consent: {
      signed: false,
      signedDate: '',
      signedVersion: 0,
      signature: '',
    },
    ...overrides,
  };
}

describe('ConsentService', () => {
  let storage: StorageService;
  let consentService: ConsentService;

  beforeEach(() => {
    storage = createMockStorage();
    consentService = new ConsentService(storage);
  });

  describe('getConsentConfig', () => {
    it('returns default config when none exists', async () => {
      const config = await consentService.getConsentConfig();

      expect(config.version).toBe(1);
      expect(config.text).toBe('');
      expect(config.minorText).toBe('');
      expect(config.updatedDate).toBeDefined();
    });

    it('returns stored config when it exists', async () => {
      const storedConfig: ConsentConfig = {
        version: 3,
        updatedDate: '2024-06-01T00:00:00.000Z',
        text: 'Texto para adultos',
        minorText: 'Texto para menores',
      };
      await storage.set('consent_config', storedConfig);

      const config = await consentService.getConsentConfig();

      expect(config).toEqual(storedConfig);
    });
  });

  describe('updateConsentVersion', () => {
    it('increments version number', async () => {
      const config = await consentService.updateConsentVersion('Texto adultos v2', 'Texto menores v2');

      expect(config.version).toBe(2);
      expect(config.text).toBe('Texto adultos v2');
      expect(config.minorText).toBe('Texto menores v2');
    });

    it('sets updatedDate to current date', async () => {
      const before = new Date().toISOString();
      const config = await consentService.updateConsentVersion('Texto', 'Texto menor');
      const after = new Date().toISOString();

      expect(config.updatedDate >= before).toBe(true);
      expect(config.updatedDate <= after).toBe(true);
    });

    it('marks all students as pending (signed: false)', async () => {
      const students: Student[] = [
        createTestStudent({
          id: 'student-1',
          consent: { signed: true, signedDate: '2024-01-01', signedVersion: 1, signature: 'sig1' },
        }),
        createTestStudent({
          id: 'student-2',
          firstName: 'Ana',
          consent: { signed: true, signedDate: '2024-01-02', signedVersion: 1, signature: 'sig2' },
        }),
      ];
      await storage.set('students', students);

      await consentService.updateConsentVersion('Nuevo texto', 'Nuevo texto menor');

      const updatedStudents = await storage.get<Student[]>('students');
      expect(updatedStudents![0].consent.signed).toBe(false);
      expect(updatedStudents![1].consent.signed).toBe(false);
    });

    it('handles case where no students exist', async () => {
      // Should not throw
      const config = await consentService.updateConsentVersion('Texto', 'Texto menor');
      expect(config.version).toBe(2);
    });

    it('increments from existing version', async () => {
      await storage.set('consent_config', {
        version: 5,
        updatedDate: '2024-01-01',
        text: 'old',
        minorText: 'old minor',
      });

      const config = await consentService.updateConsentVersion('new', 'new minor');
      expect(config.version).toBe(6);
    });
  });

  describe('signConsent', () => {
    it('signs consent for a student with current version', async () => {
      await storage.set('consent_config', {
        version: 2,
        updatedDate: '2024-06-01',
        text: 'Texto',
        minorText: 'Texto menor',
      });
      await storage.set('students', [createTestStudent()]);

      const result = await consentService.signConsent('student-1', 'base64-signature');

      expect(result.consent.signed).toBe(true);
      expect(result.consent.signedVersion).toBe(2);
      expect(result.consent.signature).toBe('base64-signature');
    });

    it('records byGuardian when provided', async () => {
      await storage.set('consent_config', {
        version: 1,
        updatedDate: '2024-06-01',
        text: 'T',
        minorText: 'TM',
      });
      await storage.set('students', [createTestStudent({ isMinor: true })]);

      const result = await consentService.signConsent('student-1', 'guardian-sig', true);

      expect(result.consent.byGuardian).toBe(true);
    });

    it('records mediaAuth when provided', async () => {
      await storage.set('consent_config', {
        version: 1,
        updatedDate: '2024-06-01',
        text: 'T',
        minorText: 'TM',
      });
      await storage.set('students', [createTestStudent()]);

      const result = await consentService.signConsent('student-1', 'sig', false, true);

      expect(result.consent.mediaAuth).toBe(true);
    });

    it('preserves previous signature in history when re-signing', async () => {
      await storage.set('consent_config', {
        version: 2,
        updatedDate: '2024-06-01',
        text: 'v2',
        minorText: 'v2 minor',
      });
      const studentWithPriorSignature = createTestStudent({
        consent: {
          signed: true,
          signedDate: '2024-01-15T10:00:00.000Z',
          signedVersion: 1,
          signature: 'old-signature',
        },
      });
      await storage.set('students', [studentWithPriorSignature]);

      const result = await consentService.signConsent('student-1', 'new-signature');

      expect(result.consent.history).toBeDefined();
      expect(result.consent.history).toHaveLength(1);
      expect(result.consent.history![0]).toEqual({
        signedDate: '2024-01-15T10:00:00.000Z',
        signedVersion: 1,
        signature: 'old-signature',
      });
      expect(result.consent.signed).toBe(true);
      expect(result.consent.signature).toBe('new-signature');
      expect(result.consent.signedVersion).toBe(2);
    });

    it('appends to existing history on multiple re-signs', async () => {
      await storage.set('consent_config', {
        version: 3,
        updatedDate: '2024-06-01',
        text: 'v3',
        minorText: 'v3 minor',
      });
      const studentWithHistory = createTestStudent({
        consent: {
          signed: true,
          signedDate: '2024-03-01T00:00:00.000Z',
          signedVersion: 2,
          signature: 'sig-v2',
          history: [
            { signedDate: '2024-01-01T00:00:00.000Z', signedVersion: 1, signature: 'sig-v1' },
          ],
        },
      });
      await storage.set('students', [studentWithHistory]);

      const result = await consentService.signConsent('student-1', 'sig-v3');

      expect(result.consent.history).toHaveLength(2);
      expect(result.consent.history![0].signedVersion).toBe(1);
      expect(result.consent.history![1].signedVersion).toBe(2);
      expect(result.consent.signedVersion).toBe(3);
    });

    it('throws when student not found', async () => {
      await storage.set('students', [createTestStudent()]);

      await expect(
        consentService.signConsent('non-existent', 'sig'),
      ).rejects.toThrow('Estudiante con id "non-existent" no encontrado.');
    });

    it('throws when no students exist', async () => {
      await expect(
        consentService.signConsent('student-1', 'sig'),
      ).rejects.toThrow('No se encontraron estudiantes registrados.');
    });
  });

  describe('deferConsent', () => {
    it('marks consent as pending for a minor', async () => {
      const minorStudent = createTestStudent({
        id: 'minor-1',
        isMinor: true,
        consent: {
          signed: false,
          signedDate: '',
          signedVersion: 0,
          signature: '',
        },
      });
      await storage.set('students', [minorStudent]);

      const result = await consentService.deferConsent('minor-1');

      expect(result.consent.signed).toBe(false);
      expect(result.consent.signature).toBe('');
    });

    it('preserves existing history when deferring', async () => {
      const studentWithHistory = createTestStudent({
        id: 'minor-1',
        isMinor: true,
        consent: {
          signed: true,
          signedDate: '2024-01-01',
          signedVersion: 1,
          signature: 'old-sig',
          history: [
            { signedDate: '2023-06-01', signedVersion: 0, signature: 'very-old-sig' },
          ],
        },
      });
      await storage.set('students', [studentWithHistory]);

      const result = await consentService.deferConsent('minor-1');

      expect(result.consent.signed).toBe(false);
      expect(result.consent.history).toHaveLength(1);
    });

    it('throws when student not found', async () => {
      await storage.set('students', [createTestStudent()]);

      await expect(
        consentService.deferConsent('non-existent'),
      ).rejects.toThrow('Estudiante con id "non-existent" no encontrado.');
    });
  });

  describe('getStudentConsentStatus', () => {
    it('returns upToDate true when student signed current version', async () => {
      await storage.set('consent_config', {
        version: 2,
        updatedDate: '2024-06-01',
        text: 'T',
        minorText: 'TM',
      });
      await storage.set('students', [
        createTestStudent({
          consent: { signed: true, signedDate: '2024-06-01', signedVersion: 2, signature: 'sig' },
        }),
      ]);

      const status = await consentService.getStudentConsentStatus('student-1');

      expect(status.upToDate).toBe(true);
      expect(status.signed).toBe(true);
      expect(status.currentVersion).toBe(2);
      expect(status.studentVersion).toBe(2);
    });

    it('returns upToDate false when student signed old version', async () => {
      await storage.set('consent_config', {
        version: 3,
        updatedDate: '2024-06-01',
        text: 'T',
        minorText: 'TM',
      });
      await storage.set('students', [
        createTestStudent({
          consent: { signed: true, signedDate: '2024-01-01', signedVersion: 1, signature: 'sig' },
        }),
      ]);

      const status = await consentService.getStudentConsentStatus('student-1');

      expect(status.upToDate).toBe(false);
      expect(status.studentVersion).toBe(1);
      expect(status.currentVersion).toBe(3);
    });

    it('returns upToDate false when student has not signed', async () => {
      await storage.set('consent_config', {
        version: 1,
        updatedDate: '2024-06-01',
        text: 'T',
        minorText: 'TM',
      });
      await storage.set('students', [createTestStudent()]);

      const status = await consentService.getStudentConsentStatus('student-1');

      expect(status.upToDate).toBe(false);
      expect(status.signed).toBe(false);
    });

    it('throws when student not found', async () => {
      await storage.set('students', [createTestStudent()]);

      await expect(
        consentService.getStudentConsentStatus('non-existent'),
      ).rejects.toThrow('Estudiante con id "non-existent" no encontrado.');
    });
  });

  describe('getAllPendingStudents', () => {
    it('returns empty array when no students exist', async () => {
      const pending = await consentService.getAllPendingStudents();
      expect(pending).toEqual([]);
    });

    it('returns students who have not signed', async () => {
      await storage.set('consent_config', {
        version: 1,
        updatedDate: '2024-06-01',
        text: 'T',
        minorText: 'TM',
      });
      await storage.set('students', [
        createTestStudent({ id: 'signed', consent: { signed: true, signedDate: '2024-06-01', signedVersion: 1, signature: 'sig' } }),
        createTestStudent({ id: 'unsigned', firstName: 'Ana' }),
      ]);

      const pending = await consentService.getAllPendingStudents();

      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('unsigned');
    });

    it('returns students whose signed version does not match current', async () => {
      await storage.set('consent_config', {
        version: 3,
        updatedDate: '2024-06-01',
        text: 'T',
        minorText: 'TM',
      });
      await storage.set('students', [
        createTestStudent({ id: 's1', consent: { signed: true, signedDate: '2024-06-01', signedVersion: 3, signature: 'sig' } }),
        createTestStudent({ id: 's2', consent: { signed: true, signedDate: '2024-01-01', signedVersion: 2, signature: 'sig' } }),
        createTestStudent({ id: 's3', consent: { signed: true, signedDate: '2024-01-01', signedVersion: 1, signature: 'sig' } }),
      ]);

      const pending = await consentService.getAllPendingStudents();

      expect(pending).toHaveLength(2);
      expect(pending.map((s) => s.id)).toContain('s2');
      expect(pending.map((s) => s.id)).toContain('s3');
    });
  });
});
