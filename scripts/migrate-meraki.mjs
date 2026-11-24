#!/usr/bin/env node
/**
 * Migra a GymOps el respaldo JSON que exporta la app anterior de MERAKI.
 *
 *   node scripts/migrate-meraki.mjs <respaldo.json>           # en seco: solo cuenta
 *   GYMOPS_API_URL=… GYMOPS_TOKEN=… node scripts/migrate-meraki.mjs <respaldo.json> --apply
 *
 * Solo crea (POST) y actualiza (PUT); nunca borra. Un alumno que ya existe (409)
 * se omite junto con sus pagos y cortesías, así que se puede repetir sin duplicar.
 * La salida no muestra nombres ni documentos: los avisos citan la posición.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MAX_BODY = 340_000; // margen bajo validate.MaxBodyBytes (350 KB) de la API
const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** Pago de la app anterior → cuerpo de POST /payments, o null si no se migra. */
export function mapPayment(p, studentId, asOf = today()) {
  // En la app anterior solo 'paid' es dinero recibido; 'credit'/'paid-credit' son la deuda (sus abonos van aparte como 'paid').
  if (p?.status !== 'paid') return null;
  const date = str(p.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > asOf) return { error: 'fecha inválida o futura' };
  const discount = Math.max(0, num(p.discount));
  // La app anterior guarda el neto; la API recibe el bruto y el descuento.
  const gross = Math.max(0, num(p.amount)) + discount;
  if (gross <= 0) return { error: 'monto cero' };
  const splits = Array.isArray(p.splits) && p.splits.length > 0 ? p.splits : null;
  const body = {
    studentId,
    date,
    concept: 'membership',
    plan: str(p.planName),
    category: p.category === 'personalizada' ? 'personalizada' : 'mensualidad',
    grossAmount: gross,
    paymentType: splits ? 'split' : 'full',
    method: str(p.method) || 'Efectivo',
    extendMembership: false, // el vencimiento viene del respaldo, no se recalcula
  };
  if (discount > 0) body.discount = { type: 'fixed', value: discount, reason: str(p.discountReason) };
  if (splits) body.splits = splits.map((s) => ({ method: str(s.method) || 'Efectivo', amount: num(s.amount) }));
  return { body };
}

/** Alumno de la app anterior → cuerpo de POST /students (sin pagos). */
export function mapStudent(s) {
  const emergencyContact = [s.emergencyName, s.emergencyPhone].map(str).filter(Boolean).join(' - ');
  return {
    firstName: str(s.firstName),
    lastName: str(s.lastName),
    documentId: str(s.documentId),
    phone: str(s.phone),
    email: str(s.email),
    dateOfBirth: str(s.dateOfBirth),
    bloodType: str(s.bloodType),
    enrollmentDate: str(s.firstRegistrationDate) || str(s.registrationDate),
    expirationDate: str(s.subscriptionEndDate),
    plan: str(s.planName),
    planId: str(s.planId),
    planCategory: str(s.planCategory),
    monthlyFee: num(s.monthlyFee),
    isMinor: Boolean(s.isMinor),
    guardianName: str(s.guardianName),
    guardianDoc: str(s.guardianDocument),
    emergencyContact,
    medicalNotes: str(s.medicalNotes),
    beltGrade: str(s.beltRank),
    photo: str(s.photo),
    consent: s.consent ?? undefined,
    consentSigned: Boolean(s.consent?.signed),
    customFields: s.emergencyRelation ? { emergencyRelation: str(s.emergencyRelation) } : undefined,
  };
}

/** Estado no activo → PUT /students/{id}; el POST de la API siempre crea activos. */
export function mapStatus(s) {
  if (s.status === 'frozen') {
    return { status: 'frozen', freezeStart: str(s.freezeDate), freezeEnd: str(s.freezeEndDate), freezeReason: str(s.freezeReason) || 'Congelado' };
  }
  if (s.status === 'inactive') return { status: 'inactive' };
  return null;
}

/** Plan de planes: tabla `costs` de la app anterior → `plans` de /settings. */
export function mapPlans(costs) {
  const one = (category) => (p) => ({ id: str(p.id), name: str(p.name), price: num(p.price), category, single: Boolean(p.single) });
  return [
    ...(costs?.memberships ?? []).map(one('membership')),
    ...(costs?.personalized ?? []).map(one('personal')),
  ].filter((p) => p.id && p.name);
}

/** Respaldo completo → lista de operaciones y avisos, sin tocar la red. */
export function buildMigration(backup, asOf = today()) {
  if (!backup || typeof backup !== 'object' || !Array.isArray(backup.students ?? [])) {
    throw new Error('El archivo no parece un respaldo de la app anterior');
  }
  const warnings = [];
  const seen = new Set();
  const students = [];

  (backup.students ?? []).forEach((s, i) => {
    const pos = `alumno #${i + 1}`;
    const body = mapStudent(s ?? {});
    if (!body.firstName || !body.lastName || !body.documentId) return warnings.push(`${pos}: sin nombre, apellido o documento; omitido`);
    if (seen.has(body.documentId)) return warnings.push(`${pos}: documento repetido en el respaldo; omitido`);
    seen.add(body.documentId);
    const id = body.documentId; // la API usa el documento como id
    // La API rechaza cuerpos de más de 350 KB; la foto es lo que más pesa y se puede volver a subir.
    if (JSON.stringify(body).length > MAX_BODY && body.photo) {
      body.photo = '';
      warnings.push(`${pos}: foto demasiado pesada; se migra sin foto`);
    }
    if (JSON.stringify(body).length > MAX_BODY) return warnings.push(`${pos}: datos de más de 350 KB (firma del consentimiento); omitido`);

    const payments = [];
    let pendingCredit = 0;
    (s.payments ?? []).forEach((p, j) => {
      if (p?.status === 'credit') pendingCredit += Math.max(0, num(p.credit?.total) - num(p.credit?.paidAmount));
      const r = mapPayment(p, id, asOf);
      if (r?.error) warnings.push(`${pos}, pago #${j + 1}: ${r.error}; omitido`);
      else if (r) payments.push(r.body);
    });
    if (pendingCredit > 0) warnings.push(`${pos}: crédito con saldo pendiente de $${pendingCredit}; regístralo a mano en GymOps`);

    const courtesies = (s.courtesyBonuses ?? []).map((c) => ({
      studentId: id,
      studentName: `${body.firstName} ${body.lastName}`,
      startDate: str(c.startDate),
      endDate: str(c.endDate),
      weeks: num(c.weeks),
      reason: str(c.reason) || 'Cortesía',
    }));

    students.push({ id, body, payments, courtesies, status: mapStatus(s) });
  });

  // Sin id la API usa la hora en segundos como id: dos artículos en el mismo segundo se pisarían.
  const inventory = (backup.inventory ?? []).filter((x) => str(x?.name)).map((x, i) => ({
    id: str(x.id) || `meraki-${i + 1}`,
    name: str(x.name),
    type: x.kind === 'service' ? 'service' : 'product',
    price: num(x.price),
    cost: num(x.cost),
    stock: x.kind === 'service' ? 0 : num(x.stock),
  }));

  // La API fecha los movimientos y ventas con el día de la carga: subirlos inflaría el mes actual.
  const finance = (backup.finance ?? []).length;
  const sales = (backup.sales ?? []).length;
  if (finance) warnings.push(`${finance} movimientos manuales de finanzas no se migran (la API los fecharía hoy)`);
  if (sales) warnings.push(`${sales} ventas no se migran (la API las fecharía hoy y descontaría stock otra vez)`);

  return { students, plans: mapPlans(backup.costs), inventory, warnings };
}

export function summarize(m) {
  const count = (k) => m.students.reduce((a, s) => a + s[k].length, 0);
  return {
    alumnos: m.students.length,
    pagos: count('payments'),
    cortesias: count('courtesies'),
    congeladosOInactivos: m.students.filter((s) => s.status).length,
    planes: m.plans.length,
    inventario: m.inventory.length,
    avisos: m.warnings.length,
  };
}

export async function apply(m, baseUrl, token) {
  const call = async (method, path, body) => {
    const res = await fetch(baseUrl.replace(/\/$/, '') + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // Con un token inválido o vencido no tiene sentido seguir: cada llamada fallaría.
    if (res.status === 401 || res.status === 403) throw new Error(`La API rechazó el token (HTTP ${res.status}); no se migró nada más.`);
    return { status: res.status, json: res.ok ? await res.json().catch(() => null) : null };
  };
  const done = { alumnos: 0, existentes: 0, pagos: 0, cortesias: 0, inventario: 0, fallos: [] };
  const fail = (what, status) => done.fallos.push(`${what}: HTTP ${status}`);

  if (m.plans.length) {
    const cur = await call('GET', '/settings');
    if (cur.status !== 200) fail('leer ajustes', cur.status);
    else {
      const settings = cur.json?.data ?? cur.json;
      const put = await call('PUT', '/settings', { ...settings, plans: m.plans });
      if (put.status !== 200) fail('guardar planes', put.status);
    }
  }

  for (const [i, s] of m.students.entries()) {
    const pos = `alumno #${i + 1}`;
    const created = await call('POST', '/students', s.body);
    if (created.status === 409) { done.existentes++; continue; }
    if (created.status !== 201 && created.status !== 200) { fail(pos, created.status); continue; }
    done.alumnos++;
    for (const p of s.payments) {
      const r = await call('POST', '/payments', p);
      if (r.status === 201 || r.status === 200) done.pagos++; else fail(`${pos}, pago del ${p.date}`, r.status);
    }
    for (const c of s.courtesies) {
      const r = await call('POST', '/courtesies', c);
      if (r.status === 201 || r.status === 200) done.cortesias++; else fail(`${pos}, cortesía`, r.status);
    }
    if (s.status) {
      const r = await call('PUT', `/students/${encodeURIComponent(s.id)}`, s.status);
      if (r.status !== 200) fail(`${pos}, estado`, r.status);
    }
  }

  // La API sobrescribe un artículo con el mismo id: se saltan los que ya existen para no devolver su stock al del respaldo.
  const inv = m.inventory.length ? await call('GET', '/inventory') : null;
  const existing = new Set(((inv?.json?.data ?? inv?.json) || []).map((x) => x.id));
  if (inv && inv.status !== 200) return fail('leer inventario', inv.status), done;
  for (const [i, item] of m.inventory.entries()) {
    if (existing.has(item.id)) { done.inventarioExistente = (done.inventarioExistente ?? 0) + 1; continue; }
    const r = await call('POST', '/inventory', item);
    if (r.status === 201 || r.status === 200) done.inventario++; else fail(`inventario #${i + 1}`, r.status);
  }
  return done;
}

async function main(argv) {
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Uso: node scripts/migrate-meraki.mjs <respaldo.json> [--apply]');
    process.exit(2);
  }
  const m = buildMigration(JSON.parse(readFileSync(file, 'utf8')));
  console.log('Plan de migración:', summarize(m));
  m.warnings.forEach((w) => console.log('  aviso:', w));

  if (!argv.includes('--apply')) {
    console.log('\nEn seco: no se envió nada. Agrega --apply con GYMOPS_API_URL y GYMOPS_TOKEN para migrar.');
    return;
  }
  const { GYMOPS_API_URL: url, GYMOPS_TOKEN: token } = process.env;
  if (!url || !token) {
    console.error('Faltan GYMOPS_API_URL y GYMOPS_TOKEN.');
    process.exit(2);
  }
  const done = await apply(m, url, token);
  console.log('\nResultado:', { ...done, fallos: done.fallos.length });
  done.fallos.forEach((f) => console.log('  fallo:', f));
  if (done.fallos.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
