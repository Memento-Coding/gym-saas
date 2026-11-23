import { describe, it, expect } from 'vitest';
import { apiToStudent, studentToApi, type ApiStudent } from './studentMapper';
import { buildStudentDefaults } from '@/components/students/studentFormFields';
import type { Student } from '@/types/student';

const student = (over: Partial<Student> = {}): Student => ({
  ...buildStudentDefaults(),
  id: 's1',
  status: 'active',
  firstName: 'Ana',
  lastName: 'Gómez',
  documentId: '1001',
  ...over,
});

describe('contacto de emergencia en la API', () => {
  it('se envía como el texto combinado de siempre', () => {
    const api = studentToApi(student({ emergencyName: 'Luis Gómez', emergencyPhone: '3001234567' }));
    expect(api.emergencyContact).toBe('Luis Gómez - 3001234567');
  });

  it('sin datos se envía vacío', () => {
    expect(studentToApi(student()).emergencyContact).toBe('');
  });

  it('un registro histórico (solo texto) se parte en nombre y teléfono al leerlo', () => {
    const fromApi: ApiStudent = { id: 's1', emergencyContact: 'Luis Gómez - 3001234567' };
    expect(apiToStudent(fromApi)).toMatchObject({
      emergencyName: 'Luis Gómez',
      emergencyPhone: '3001234567',
    });
  });

  it('históricos con solo teléfono, solo nombre o texto libre no pierden datos', () => {
    expect(apiToStudent({ id: 's1', emergencyContact: '3001234567' })).toMatchObject({
      emergencyName: '',
      emergencyPhone: '3001234567',
    });
    expect(apiToStudent({ id: 's1', emergencyContact: 'Mamá' })).toMatchObject({
      emergencyName: 'Mamá',
      emergencyPhone: '',
    });
    const free = apiToStudent({ id: 's1', emergencyContact: 'Llamar a Pedro - ver nota' });
    expect(studentToApi(free).emergencyContact).toBe('Llamar a Pedro - ver nota');
  });

  it('guardar y volver a leer devuelve los mismos campos', () => {
    const original = student({ emergencyName: 'Ana - Madre', emergencyPhone: '+57 300 123 4567' });
    const back = apiToStudent(studentToApi(original) as ApiStudent & { id: string }, undefined);
    expect(back.emergencyName).toBe('Ana - Madre');
    expect(back.emergencyPhone).toBe('+57 300 123 4567');
  });

  it('si la API no trae el contacto, no borra lo que había localmente', () => {
    const prev = student({ emergencyName: 'Luis', emergencyPhone: '3001234567' });
    const merged = apiToStudent({ id: 's1' }, prev);
    expect(merged).toMatchObject({ emergencyName: 'Luis', emergencyPhone: '3001234567' });
  });

  it('si la API trae un texto distinto al local, gana el de la API', () => {
    const prev = student({ emergencyName: 'Luis', emergencyPhone: '3001234567' });
    const merged = apiToStudent({ id: 's1', emergencyContact: 'Marta - 3109998877' }, prev);
    expect(merged).toMatchObject({ emergencyName: 'Marta', emergencyPhone: '3109998877' });
  });
});
