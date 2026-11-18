import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADULTS_ONLY_FIELD,
  DEFAULT_STUDENT_FIELDS,
  STUDENT_FIELD_CATALOG,
  isAdultsOnly,
  resolveStudentFields,
} from '@/components/students/studentFormFields';
import type { FormFieldConfig } from '@/types/settings';

// El "servidor" guarda el objeto /settings tal como llega en el PUT.
const server = vi.hoisted(() => ({ settings: {} as Record<string, unknown> }));
vi.mock('../apiClient', () => ({
  api: {
    get: vi.fn(async () => structuredClone(server.settings)),
    put: vi.fn(async (_path: string, body: Record<string, unknown>) => {
      server.settings = structuredClone(body);
      return {};
    }),
  },
}));

import { SettingsResource } from './settingsResource';

const catalog = (name: string, over: Partial<FormFieldConfig> = {}): FormFieldConfig => ({
  ...STUDENT_FIELD_CATALOG.find((f) => f.name === name)!,
  ...over,
});
const talla: FormFieldConfig = {
  id: 'f1', name: 'custom_talla', label: 'Talla', type: 'select', required: false, isBuiltIn: false,
  options: ['S', 'M', 'L'],
};

describe('formFields vía /settings', () => {
  beforeEach(() => {
    server.settings = {};
  });

  it('conserva orden, alias de campos del sistema, contacto de emergencia y solo-adultos tras recargar', async () => {
    const saved: FormFieldConfig[] = [
      catalog('lastName'),
      catalog('firstName'),
      talla,
      catalog('documentId'),
      catalog('planName'),
      catalog('subscriptionEndDate'),
      catalog('beltRank', { label: 'Nivel' }),
      catalog('emergencyContact', { label: 'Persona de contacto', required: true }),
      ADULTS_ONLY_FIELD,
    ];

    await new SettingsResource().setKey('formFields', saved);

    // Una instancia nueva = recarga de la página: lee solo lo que guardó el servidor.
    const reloaded = (await new SettingsResource().getKey<FormFieldConfig[]>('formFields'))!;
    expect(reloaded.map((f) => f.name)).toEqual(saved.map((f) => f.name));
    expect(isAdultsOnly(reloaded)).toBe(true);

    const resolved = resolveStudentFields(reloaded);
    expect(resolved.map((f) => f.name)).toEqual([
      'lastName', 'firstName', 'custom_talla', 'documentId', 'planName',
      'subscriptionEndDate', 'beltRank', 'emergencyContact',
    ]);
    expect(resolved.find((f) => f.name === 'beltRank')).toMatchObject({ label: 'Nivel' });
    expect(resolved.find((f) => f.name === 'emergencyContact')).toMatchObject({
      label: 'Persona de contacto',
      required: true,
    });
    expect(resolved.find((f) => f.name === 'custom_talla')).toMatchObject({
      isBuiltIn: false,
      options: ['S', 'M', 'L'],
    });
  });

  it('sin solo-adultos guardado, el bloque de menor sigue activo', async () => {
    await new SettingsResource().setKey('formFields', DEFAULT_STUDENT_FIELDS);
    const reloaded = (await new SettingsResource().getKey<FormFieldConfig[]>('formFields'))!;
    expect(isAdultsOnly(reloaded)).toBe(false);
  });

  it('no pisa otras secciones de /settings al guardar los campos', async () => {
    server.settings = { plans: [{ id: 'p', name: 'Mensual', price: 1 }], branding: { logo: 'x' } };
    await new SettingsResource().setKey('formFields', DEFAULT_STUDENT_FIELDS);
    expect(server.settings.plans).toEqual([{ id: 'p', name: 'Mensual', price: 1 }]);
  });
});
