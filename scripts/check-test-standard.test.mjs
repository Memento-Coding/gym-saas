import assert from 'node:assert/strict';
import test from 'node:test';
import { checkFeature, checkPages } from './check-test-standard.mjs';

const valid = `# language: es
@e2e @pagos
Característica: X

  @smoke @critico
  Escenario: A

  @adversarial
  Escenario: B
`;

test('un feature completo pasa', () => assert.deepEqual(checkFeature(valid, 'pagos'), []));

test('exige escenarios adversarios', () => {
  assert.match(checkFeature(valid.replace('@adversarial', '@regresion'), 'pagos').join(), /@adversarial/);
});

test('exige los tags del módulo', () => {
  assert.match(checkFeature(valid.replace('@pagos', '@otro'), 'pagos').join(), /@pagos/);
});

test('rechaza fechas literales', () => {
  assert.match(checkFeature(`${valid}\n    Dado vence "2025-12-31"`, 'pagos').join(), /fecha literal/);
});

test('@fixme necesita explicación', () => {
  assert.match(checkFeature(`${valid}\n    @fixme\n    Ejemplos: X`, 'pagos').join(), /@fixme/);
  assert.deepEqual(checkFeature(`${valid}\n    # BUG: motivo\n    @fixme\n    Ejemplos: X`, 'pagos'), []);
});

test('una página nueva sin feature falla', () => {
  assert.match(checkPages(['NuevaPage'], ['pagos']).join(), /NuevaPage/);
  assert.match(checkPages(['FinancePage'], ['pagos']).join(), /finanzas/);
  assert.deepEqual(checkPages(['LoginPage'], []), []);
});
