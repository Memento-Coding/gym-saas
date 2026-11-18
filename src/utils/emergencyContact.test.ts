import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseEmergencyContact, serializeEmergencyContact } from './emergencyContact';

describe('serializeEmergencyContact', () => {
  it('usa el formato de la API: "Nombre - Teléfono"', () => {
    expect(serializeEmergencyContact('Ana Gómez', '3001234567')).toBe('Ana Gómez - 3001234567');
  });
  it('si falta una parte solo aparece la otra', () => {
    expect(serializeEmergencyContact('Ana', '')).toBe('Ana');
    expect(serializeEmergencyContact('', '3001234567')).toBe('3001234567');
    expect(serializeEmergencyContact(undefined, undefined)).toBe('');
  });
  it('recorta espacios', () => {
    expect(serializeEmergencyContact('  Ana ', ' 300 ')).toBe('Ana - 300');
  });
});

describe('parseEmergencyContact', () => {
  it('parte un texto con nombre y teléfono', () => {
    expect(parseEmergencyContact('Ana Gómez - 3001234567')).toEqual({ name: 'Ana Gómez', phone: '3001234567' });
  });
  it('admite teléfonos con +57, espacios y guiones', () => {
    expect(parseEmergencyContact('Luis - +57 300 123-4567')).toEqual({ name: 'Luis', phone: '+57 300 123-4567' });
  });
  it('un nombre con guion sigue siendo nombre y toma el último tramo como teléfono', () => {
    expect(parseEmergencyContact('Ana - Madre - 3001234567')).toEqual({ name: 'Ana - Madre', phone: '3001234567' });
  });
  it('un texto histórico solo con teléfono o solo con nombre se asigna a su campo', () => {
    expect(parseEmergencyContact('3001234567')).toEqual({ name: '', phone: '3001234567' });
    expect(parseEmergencyContact('Mamá')).toEqual({ name: 'Mamá', phone: '' });
  });
  it('un texto libre que no encaja se conserva entero como nombre (sin perder datos)', () => {
    expect(parseEmergencyContact('Llamar a Pedro - ver nota')).toEqual({ name: 'Llamar a Pedro - ver nota', phone: '' });
  });
  it('vacío, nulo o solo espacios', () => {
    expect(parseEmergencyContact('')).toEqual({ name: '', phone: '' });
    expect(parseEmergencyContact(null)).toEqual({ name: '', phone: '' });
    expect(parseEmergencyContact('   ')).toEqual({ name: '', phone: '' });
  });
});

describe('ida y vuelta', () => {
  it('cualquier texto histórico se reserializa idéntico', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (raw) => {
        const text = raw.trim();
        const { name, phone } = parseEmergencyContact(text);
        expect(serializeEmergencyContact(name, phone)).toBe(text);
      }),
    );
  });

  it('nombre + teléfono válidos vuelven iguales', () => {
    const name = fc.stringMatching(/^[A-Za-zÁÉÍÓÚáéíóúñ]+( [A-Za-zÁÉÍÓÚáéíóúñ]+){0,2}$/);
    const phone = fc.stringMatching(/^3\d{9}$/);
    fc.assert(
      fc.property(name, phone, (n, p) => {
        expect(parseEmergencyContact(serializeEmergencyContact(n, p))).toEqual({ name: n, phone: p });
      }),
    );
  });
});
