import { describe, it, expect } from 'vitest';
import { detectPlanRenames, applyPlanRenames } from '@/services/MembershipService';
import type { CostsConfig } from '@/types/membership';

const cfg = (plans: Array<[string, string]>) =>
  ({ memberships: plans.map(([id, name]) => ({ id, name, price: 10 })), personalized: [] }) as unknown as CostsConfig;

describe('detectPlanRenames', () => {
  it('detecta planes con mismo id y distinto nombre', () => {
    const r = detectPlanRenames(cfg([['a', 'Mensual'], ['b', 'Anual']]), cfg([['a', 'Mensual Plus'], ['b', 'Anual']]));
    expect(r).toEqual([{ id: 'a', oldName: 'Mensual', newName: 'Mensual Plus' }]);
  });
  it('sin configuración previa no hay renombres', () => {
    expect(detectPlanRenames(null, cfg([['a', 'X']]))).toEqual([]);
  });
  it('planes nuevos o eliminados no son renombres', () => {
    expect(detectPlanRenames(cfg([['a', 'X']]), cfg([['b', 'Y']]))).toEqual([]);
  });
});

describe('applyPlanRenames', () => {
  const renames = [{ id: 'a', oldName: 'Mensual', newName: 'Mensual Plus' }];

  it('actualiza por planId', () => {
    const [s] = applyPlanRenames([{ planId: 'a', planName: 'Mensual' }], renames);
    expect(s.planName).toBe('Mensual Plus');
  });
  it('estudiante legacy (sin planId) se vincula por nombre antiguo', () => {
    const [s] = applyPlanRenames([{ planName: 'Mensual' }], renames);
    expect(s).toMatchObject({ planId: 'a', planName: 'Mensual Plus' });
  });
  it('no toca estudiantes de otros planes ni legacy con otro nombre', () => {
    const input = [{ planId: 'b', planName: 'Anual' }, { planName: 'Otro' }];
    const out = applyPlanRenames(input, renames);
    expect(out[0]).toBe(input[0]);
    expect(out[1]).toBe(input[1]);
  });
  it('un estudiante con planId distinto no se confunde por nombre', () => {
    const input = [{ planId: 'b', planName: 'Mensual' }];
    expect(applyPlanRenames(input, renames)[0]).toBe(input[0]);
  });
  it('sin renombres devuelve los mismos objetos', () => {
    const input = [{ planId: 'a', planName: 'Mensual' }];
    expect(applyPlanRenames(input, [])[0]).toBe(input[0]);
  });
});


