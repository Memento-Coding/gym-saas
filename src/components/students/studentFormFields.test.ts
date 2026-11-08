import { describe, it, expect } from 'vitest';

import type { FormFieldConfig } from '@/types/settings';
import { DEFAULT_STUDENT_FIELDS, resolveStudentFields } from './studentFormFields';

const custom: FormFieldConfig = {
  id: 'f1', name: 'custom_talla', label: 'Talla', type: 'text', required: true, isBuiltIn: false,
};
const pick = (name: string, required = false): FormFieldConfig => ({
  id: name, name, label: name, type: 'text', required, isBuiltIn: true,
});
const names = (fields: FormFieldConfig[]) => fields.map((f) => f.name);

describe('resolveStudentFields', () => {
  it('sin configuración usa los campos por defecto', () => {
    expect(resolveStudentFields([])).toEqual(DEFAULT_STUDENT_FIELDS);
  });

  it('con solo campos propios conserva los del sistema y agrega los propios', () => {
    expect(names(resolveStudentFields([custom]))).toEqual([
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
