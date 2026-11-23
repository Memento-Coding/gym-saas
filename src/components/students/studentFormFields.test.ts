import { describe, it, expect } from 'vitest';
import {
  ADULTS_ONLY_FIELD,
  DEFAULT_STUDENT_FIELDS,
  STUDENT_FIELD_CATALOG,
  isAdultsOnly,
  resolveStudentFields,
  withAdultsOnly,
} from './studentFormFields';
import type { FormFieldConfig } from '@/types/settings';

const sys = (name: string, over: Partial<FormFieldConfig> = {}): FormFieldConfig => ({
  ...STUDENT_FIELD_CATALOG.find((f) => f.name === name)!,
  ...over,
});
const custom: FormFieldConfig = {
  id: 'f1', name: 'custom_talla', label: 'Talla', type: 'text', required: false, isBuiltIn: false,
};
const names = (fields: FormFieldConfig[]) => fields.map((f) => f.name);

describe('resolveStudentFields — orden', () => {
  it('sin configuración usa los campos por defecto en su orden', () => {
    expect(names(resolveStudentFields([]))).toEqual(names(DEFAULT_STUDENT_FIELDS));
  });

  it('respeta exactamente el orden guardado, mezclando campos del sistema y propios', () => {
    const saved = resolveStudentFields([]).map((f) => ({ ...f }));
    // El campo propio va al principio y el teléfono antes que los nombres.
    const reordered = [custom, sys('phone'), ...saved.filter((f) => f.name !== 'phone')];
    expect(names(resolveStudentFields(reordered))).toEqual(names(reordered));
  });

  it('el orden sobrevive a guardar y volver a resolver (recarga)', () => {
    const once = resolveStudentFields([sys('email'), custom, ...DEFAULT_STUDENT_FIELDS.filter((f) => f.name !== 'email')]);
    const reloaded = resolveStudentFields(JSON.parse(JSON.stringify(once)));
    expect(names(reloaded)).toEqual(names(once));
  });

  it('sin configuración del sistema, los campos propios van al final', () => {
    expect(names(resolveStudentFields([custom])).at(-1)).toBe('custom_talla');
  });

  it('un campo bloqueado que falta en lo guardado vuelve a su lugar', () => {
    const saved = [sys('firstName'), sys('lastName'), sys('documentId'), sys('subscriptionEndDate')];
    const names2 = names(resolveStudentFields(saved));
    expect(names2).toContain('planName');
    expect(names2.indexOf('planName')).toBeGreaterThan(names2.indexOf('documentId'));
  });

  it('ignora duplicados y la marca adultsOnly', () => {
    const resolved = resolveStudentFields([...DEFAULT_STUDENT_FIELDS, sys('email'), ADULTS_ONLY_FIELD]);
    expect(names(resolved).filter((n) => n === 'email')).toHaveLength(1);
    expect(names(resolved)).not.toContain('adultsOnly');
  });
});

describe('resolveStudentFields — nombres de campos del sistema', () => {
  it('usa la etiqueta guardada pero conserva la clave interna', () => {
    const resolved = resolveStudentFields([...DEFAULT_STUDENT_FIELDS, sys('beltRank', { label: 'Nivel' })]);
    const belt = resolved.find((f) => f.name === 'beltRank');
    expect(belt).toMatchObject({ name: 'beltRank', id: 'beltRank', label: 'Nivel' });
  });

  it('sin alias (vacío o ausente) usa el nombre original', () => {
    const resolved = resolveStudentFields([...DEFAULT_STUDENT_FIELDS, sys('beltRank', { label: '  ' })]);
    expect(resolved.find((f) => f.name === 'beltRank')?.label).toBe('Grado o cinturón');
    expect(resolved.find((f) => f.name === 'firstName')?.label).toBe('Nombres');
  });

  it('los alias sobreviven a una recarga', () => {
    const saved = [...DEFAULT_STUDENT_FIELDS, sys('beltRank', { label: 'Nivel' })];
    const reloaded = resolveStudentFields(JSON.parse(JSON.stringify(resolveStudentFields(saved))));
    expect(reloaded.find((f) => f.name === 'beltRank')?.label).toBe('Nivel');
  });
});

describe('contacto de emergencia', () => {
  it('es un campo del sistema apagado por defecto, activable, renombrable y ordenable', () => {
    expect(names(resolveStudentFields([]))).not.toContain('emergencyContact');
    const saved = [sys('emergencyContact', { label: 'Persona de contacto' }), ...DEFAULT_STUDENT_FIELDS];
    const resolved = resolveStudentFields(saved);
    expect(resolved[0]).toMatchObject({ name: 'emergencyContact', label: 'Persona de contacto' });
  });
});

describe('solo adultos', () => {
  it('no existe en configuraciones anteriores (el bloque de menor sigue visible)', () => {
    expect(isAdultsOnly([...DEFAULT_STUDENT_FIELDS])).toBe(false);
  });
  it('se agrega y se quita sin duplicarse', () => {
    const on = withAdultsOnly(withAdultsOnly(DEFAULT_STUDENT_FIELDS, true), true);
    expect(on.filter((f) => f.name === 'adultsOnly')).toHaveLength(1);
    expect(isAdultsOnly(on)).toBe(true);
    expect(isAdultsOnly(withAdultsOnly(on, false))).toBe(false);
  });
});

// -- Pruebas originales, conservadas --
const legacyCustom: FormFieldConfig = {
  id: 'f1', name: 'custom_talla', label: 'Talla', type: 'text', required: true, isBuiltIn: false,
};
const pick = (name: string, required = false): FormFieldConfig => ({
  ...STUDENT_FIELD_CATALOG.find((f) => f.name === name)!, required,
});


describe('resolveStudentFields (configuración anterior)', () => {
  it('sin configuración usa los campos por defecto', () => {
    expect(resolveStudentFields([])).toEqual(DEFAULT_STUDENT_FIELDS);
  });

  it('con solo campos propios conserva los del sistema y agrega los propios', () => {
    expect(names(resolveStudentFields([legacyCustom]))).toEqual([
      ...names(DEFAULT_STUDENT_FIELDS),
      'custom_talla',
    ]);
  });

  it('oculta lo que el gimnasio no pide pero nunca los campos bloqueados', () => {
    const result = names(resolveStudentFields([pick('firstName')]));
    expect(result).toEqual(['firstName', 'lastName', 'documentId', 'planName', 'subscriptionEndDate']);
  });

  it('aplica la obligatoriedad elegida y conserva la definición del catálogo', () => {
    const phone = resolveStudentFields([pick('firstName'), pick('phone', true)]).find(
      (f) => f.name === 'phone',
    );
    expect(phone).toMatchObject({ required: true, type: 'tel', label: 'Teléfono' });
  });

  it('un campo bloqueado no se puede volver opcional', () => {
    const first = resolveStudentFields([pick('firstName', false)]).find((f) => f.name === 'firstName');
    expect(first?.required).toBe(true);
  });

  it('activa un campo opcional del sistema con sus opciones', () => {
    const blood = resolveStudentFields([pick('firstName'), pick('bloodType')]).find(
      (f) => f.name === 'bloodType',
    );
    expect(blood?.options).toContain('O+');
  });
});