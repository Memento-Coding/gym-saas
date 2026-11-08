import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Student } from '@/types/student';

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../apiClient', () => ({ api: { get, put, post: vi.fn(), delete: vi.fn() } }));

import { StudentsResource } from './studentsResource';

const consent = { signed: true, signedDate: '2026-11-08', signedVersion: 1, signature: 'data:x' };
const remote = { id: '1', firstName: 'A', lastName: 'B', documentId: '1', consent };

async function loaded(): Promise<Student> {
  const [student] = (await new StudentsResource().get<Student[]>()) as Student[];
  return student;
}

describe('StudentsResource.set', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue([remote]);
    put.mockReset().mockResolvedValue({});
  });

  it('congelar se guarda en la API', async () => {
    const student = await loaded();
    await new StudentsResource().set([{ ...student, freezeReason: 'Viaje', freezeDate: '2026-11-08', freezeEndDate: '2026-12-08' }]);
    expect(put).toHaveBeenCalledWith('/students/1', expect.objectContaining({
      freezeReason: 'Viaje', freezeStart: '2026-11-08', freezeEnd: '2026-12-08',
    }));
  });

  it('una firma nueva se guarda en la API', async () => {
    const student = await loaded();
    const signed = { ...student, consent: { ...consent, signature: 'data:y' } };
    await new StudentsResource().set([signed]);
    expect(put).toHaveBeenCalledWith('/students/1', expect.objectContaining({ consent: signed.consent }));
  });

  it('el orden de las claves de consent no provoca escrituras', async () => {
    const student = await loaded();
    get.mockResolvedValue([{ ...remote, consent: { signature: 'data:x', signedVersion: 1, signedDate: '2026-11-08', signed: true } }]);
    await new StudentsResource().set([student]);
    expect(put).not.toHaveBeenCalled();
  });
});
