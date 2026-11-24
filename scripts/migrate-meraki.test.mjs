import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, buildMigration, mapPayment, mapPlans, summarize } from './migrate-meraki.mjs';

const AS_OF = '2026-11-24';
const alumno = (extra = {}) => ({
  firstName: 'Ana', lastName: 'Ruiz', documentId: '123',
  emergencyName: 'Luis', emergencyPhone: '300', emergencyRelation: 'Padre',
  firstRegistrationDate: '2025-01-10', registrationDate: '2026-10-01', subscriptionEndDate: '2026-12-01',
  beltRank: 'Azul', guardianDocument: '999', status: 'active', payments: [], ...extra,
});

test('mapea los campos del alumno a los nombres de la API', () => {
  const [s] = buildMigration({ students: [alumno()] }, AS_OF).students;
  assert.equal(s.id, '123');
  assert.equal(s.body.enrollmentDate, '2025-01-10');
  assert.equal(s.body.expirationDate, '2026-12-01');
  assert.equal(s.body.emergencyContact, 'Luis - 300');
  assert.deepEqual(s.body.customFields, { emergencyRelation: 'Padre' });
  assert.equal(s.body.beltGrade, 'Azul');
  assert.equal(s.body.guardianDoc, '999');
  assert.equal(s.status, null);
});

test('el pago guarda el bruto, el descuento y no extiende la membresía', () => {
  const { body } = mapPayment({ status: 'paid', date: '2026-10-01', amount: 80000, discount: 10000, method: 'Nequi', planName: 'Básico' }, '123', AS_OF);
  assert.equal(body.grossAmount, 90000);
  assert.deepEqual(body.discount, { type: 'fixed', value: 10000, reason: '' });
  assert.equal(body.extendMembership, false);
  assert.equal(body.paymentType, 'full');
  assert.equal(body.date, '2026-10-01');
});

test('un pago dividido conserva sus partes', () => {
  const { body } = mapPayment({ status: 'paid', date: '2026-10-01', amount: 100, splits: [{ method: 'Efectivo', amount: 60 }, { method: 'Nequi', amount: 40 }] }, '1', AS_OF);
  assert.equal(body.paymentType, 'split');
  assert.equal(body.splits.length, 2);
});

test('@adversarial la deuda a crédito no se sube como dinero, pero se avisa el saldo', () => {
  const m = buildMigration({ students: [alumno({ payments: [
    { status: 'credit', date: '2026-10-01', amount: 300, method: 'Crédito', credit: { total: 300, paidAmount: 100 } },
    { status: 'paid', date: '2026-10-05', amount: 100, linkedCreditId: 'c1' },
    { status: 'paid-credit', date: '2026-09-01', amount: 200, method: 'Crédito' },
  ] })] }, AS_OF);
  assert.equal(m.students[0].payments.length, 1);
  assert.equal(m.students[0].payments[0].grossAmount, 100);
  assert.ok(m.warnings.some((w) => w.includes('$200')));
});

test('@adversarial pagos con fecha futura, inválida o en cero se omiten con aviso', () => {
  for (const p of [
    { status: 'paid', date: '2026-12-31', amount: 10 },
    { status: 'paid', date: '01/10/2026', amount: 10 },
    { status: 'paid', date: '2026-10-01', amount: 0 },
    { status: 'paid', date: '2026-10-01', amount: 'abc' },
  ]) assert.ok(mapPayment(p, '1', AS_OF).error, JSON.stringify(p));
});

test('@adversarial alumnos sin documento o repetidos se omiten sin mostrar sus datos', () => {
  const m = buildMigration({ students: [alumno(), alumno({ firstName: 'Otra' }), alumno({ documentId: '  ' }), null] }, AS_OF);
  assert.equal(m.students.length, 1);
  assert.equal(m.warnings.length, 3);
  assert.ok(m.warnings.every((w) => !w.includes('Ana') && !w.includes('123') && !w.includes('Otra')));
});

test('@adversarial una foto que pasa el límite de la API se descarta con aviso', () => {
  const m = buildMigration({ students: [alumno({ photo: 'x'.repeat(400_000) })] }, AS_OF);
  assert.equal(m.students[0].body.photo, '');
  assert.ok(m.warnings[0].includes('foto'));
});

test('congelados e inactivos se marcan después del alta', () => {
  const m = buildMigration({ students: [
    alumno({ documentId: '1', status: 'frozen', freezeDate: '2026-11-01', freezeEndDate: '2026-12-01' }),
    alumno({ documentId: '2', status: 'inactive' }),
  ] }, AS_OF);
  assert.deepEqual(m.students[0].status, { status: 'frozen', freezeStart: '2026-11-01', freezeEnd: '2026-12-01', freezeReason: 'Congelado' });
  assert.deepEqual(m.students[1].status, { status: 'inactive' });
});

test('planes, inventario y lo que no se migra', () => {
  const m = buildMigration({
    students: [],
    costs: { memberships: [{ id: 'm1', name: 'Mes', price: 80000 }, { id: '', name: 'sin id' }], personalized: [{ id: 'p1', name: 'PT', price: 200000, single: true }] },
    inventory: [{ kind: 'service', name: 'Clase', price: 10, stock: null }, { kind: 'product', name: 'Agua', price: 3, cost: 1, stock: 5 }, { name: '' }],
    finance: [{}, {}],
    sales: [{}],
  }, AS_OF);
  assert.deepEqual(mapPlans({ personalized: [{ id: 'p1', name: 'PT', price: 1 }] })[0].category, 'personal');
  assert.equal(m.plans.length, 2);
  assert.equal(m.inventory[0].stock, 0);
  assert.equal(m.inventory.length, 2);
  assert.equal(m.warnings.length, 2);
  assert.equal(summarize(m).inventario, 2);
});

test('@adversarial un archivo que no es respaldo se rechaza', () => {
  assert.throws(() => buildMigration(null));
  assert.throws(() => buildMigration({ students: 'no' }));
});

test('@adversarial al enviar: nunca borra, conserva los ajustes y salta los alumnos que ya existen', async () => {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, { method, body }) => {
    const path = url.replace('https://api.test', '');
    calls.push({ method, path, body: body && JSON.parse(body) });
    const json = (status, data) => ({ ok: status < 300, status, json: async () => data });
    if (method === 'GET' && path === '/inventory') return json(200, { data: [{ id: 'i1' }] });
    if (method === 'GET') return json(200, { data: { gymName: 'MERAKI', plans: [] } });
    if (method === 'POST' && path === '/students') return json(calls.at(-1).body.documentId === '2' ? 409 : 201, {});
    return json(method === 'POST' ? 201 : 200, {});
  };
  try {
    const m = buildMigration({
      costs: { memberships: [{ id: 'm1', name: 'Mes', price: 1 }] },
      inventory: [{ id: 'i1', kind: 'product', name: 'Agua', stock: 9 }, { kind: 'product', name: 'Sin id', stock: 1 }],
      students: [
        alumno({ documentId: '1', status: 'inactive', payments: [{ status: 'paid', date: '2026-10-01', amount: 5 }] }),
        alumno({ documentId: '2', payments: [{ status: 'paid', date: '2026-10-01', amount: 5 }] }),
      ],
    }, AS_OF);
    const done = await apply(m, 'https://api.test/', 'tok');
    assert.deepEqual({ ...done, fallos: done.fallos.length }, { alumnos: 1, existentes: 1, pagos: 1, cortesias: 0, inventario: 1, inventarioExistente: 1, fallos: 0 });
    assert.ok(calls.every((c) => c.method !== 'DELETE'));
    assert.equal(calls.find((c) => c.method === 'PUT' && c.path === '/settings').body.gymName, 'MERAKI');
    assert.equal(calls.filter((c) => c.path === '/payments').length, 1);
    assert.deepEqual(calls.filter((c) => c.method === 'POST' && c.path === '/inventory').map((c) => c.body.id), ['meraki-2']);
    assert.deepEqual(calls.find((c) => c.path === '/students/1').body, { status: 'inactive' });
  } finally {
    globalThis.fetch = real;
  }
});

test('@adversarial con un token rechazado se detiene en la primera llamada', async () => {
  let n = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async () => (n++, { ok: false, status: 401, json: async () => ({}) });
  try {
    const m = buildMigration({ students: [alumno({ documentId: '1' }), alumno({ documentId: '2' })] }, AS_OF);
    await assert.rejects(apply(m, 'https://api.test', 'malo'), /token/);
    assert.equal(n, 1);
  } finally {
    globalThis.fetch = real;
  }
});
