import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sanitizeNumericInput } from './sanitize';

describe('sanitizeNumericInput @adversarial', () => {
  it('elimina letras y símbolos', () => {
    expect(sanitizeNumericInput('abc')).toBe('');
    expect(sanitizeNumericInput('12abc34')).toBe('1234');
    expect(sanitizeNumericInput('$1,000 COP')).toBe('1000');
    expect(sanitizeNumericInput('1e5')).toBe('15');
  });

  it('conserva "-" y "." para que la validación los reporte al salir del campo', () => {
    expect(sanitizeNumericInput('-500')).toBe('-500');
    expect(sanitizeNumericInput('10.5')).toBe('10.5');
  });

  it('nunca deja letras, para cualquier entrada', () => {
    fc.assert(
      fc.property(fc.string(), (s) => /^[\d.-]*$/.test(sanitizeNumericInput(s))),
      { numRuns: 100 },
    );
  });
});
