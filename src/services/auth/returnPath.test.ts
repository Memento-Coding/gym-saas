import { describe, it, expect, beforeEach } from 'vitest';
import { clearReturnPath, peekReturnPath, rememberReturnPath, safeReturnPath } from './returnPath';

describe('safeReturnPath', () => {
  it('conserva las rutas internas con su consulta', () => {
    expect(safeReturnPath('/estudiantes/1?tab=pagos')).toBe('/estudiantes/1?tab=pagos');
  });

  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'evil', '', null, undefined, 42])(
    'manda al inicio con %s',
    (value) => {
      expect(safeReturnPath(value)).toBe('/');
    },
  );
});

describe('ruta guardada para Google', () => {
  beforeEach(() => clearReturnPath());

  it('se guarda, se lee varias veces y se borra', () => {
    rememberReturnPath('/finanzas');
    expect(peekReturnPath()).toBe('/finanzas');
    expect(peekReturnPath()).toBe('/finanzas');
    clearReturnPath();
    expect(peekReturnPath()).toBeNull();
  });

  it('no confía en un valor manipulado', () => {
    rememberReturnPath('//evil.com');
    expect(peekReturnPath()).toBe('/');
  });
});
