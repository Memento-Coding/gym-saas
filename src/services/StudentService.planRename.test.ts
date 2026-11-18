/**
 * Renombrar un plan debe reflejarse en lista, perfil y búsqueda de estudiantes,
 * incluidos los antiguos sin planId. Persiste tras "recargar" (nuevo servicio).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StudentService } from './StudentService';
import { createStorageService, resetStorageService } from './storage/StorageService';

function stu(id: string, planName: string, planId?: string) {
  return {
    id, photo: '', firstName: `Nombre${id}`, lastName: 'Apellido', documentId: `100${id}`,
    isMinor: false, guardianName: '', guardianDocument: '', phone: '3000000000', email: '',
    emergencyName: '', emergencyPhone: '', emergencyRelation: '', dateOfBirth: '', bloodType: '',
    firstRegistrationDate: '2026-08-01', recentRegistrationDate: '2026-08-01',
    registrationDate: '2026-08-01', subscriptionEndDate: '2026-12-31', monthlyFee: 1,
    planCategory: 'mensualidad' as const, planName, ...(planId ? { planId } : {}),
    payments: [], courtesyBonuses: [], medicalNotes: '', status: 'active' as const, beltRank: '',
    consent: { signed: false, signedDate: '', signedVersion: 0, signature: '' },
  };
}

beforeEach(async () => {
  localStorage.clear();
  resetStorageService();
  const storage = await createStorageService();
  await storage.set('students', [
    stu('1', 'Mensual', 'p1'),
    stu('2', 'Mensual'), // legacy
    stu('3', 'Anual', 'p2'),
  ]);
});

afterEach(() => {
  localStorage.clear();
  resetStorageService();
});

describe('StudentService.applyPlanRenames', () => {
  const renames = [{ id: 'p1', oldName: 'Mensual', newName: 'Mensual Plus' }];

  it('actualiza lista, perfil y búsqueda (incluye legacy) y persiste', async () => {
    const svc = new StudentService();
    expect(await svc.applyPlanRenames(renames)).toBe(2);

    const reloaded = new StudentService(); // simula recarga
    const all = await reloaded.getAll();
    expect(all.find((s) => s.id === '1')?.planName).toBe('Mensual Plus');
    expect(all.find((s) => s.id === '2')).toMatchObject({ planName: 'Mensual Plus', planId: 'p1' });
    expect((await reloaded.getById('2'))?.planName).toBe('Mensual Plus');
    expect(all.find((s) => s.id === '3')?.planName).toBe('Anual');

    expect((await reloaded.search('Mensual Plus')).map((s) => s.id).sort()).toEqual(['1', '2']);
    expect(await reloaded.search('Mensual Plus').then((r) => r.length)).toBe(2);
  });

  it('sin renombres no cambia nada', async () => {
    expect(await new StudentService().applyPlanRenames([])).toBe(0);
  });

  it('renombre de un id inexistente no afecta a nadie', async () => {
    const n = await new StudentService().applyPlanRenames([{ id: 'zz', oldName: 'Nada', newName: 'X' }]);
    expect(n).toBe(0);
  });
});
