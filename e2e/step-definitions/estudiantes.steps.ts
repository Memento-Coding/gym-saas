/**
 * step-definitions/estudiantes.steps.ts
 * Steps para: features/estudiantes/gestion-estudiantes.feature
 */

import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { StudentsPage } from '../pages/StudentsPage';
import { TEST_STUDENT, conNombre } from '../fixtures/students';
import { lsGet, seedAll } from '../helpers/seed';
import { diasDesdeHoy } from '../helpers/dates';

// playwright-bdd crea una instancia nueva de los steps por escenario;
// la variable de módulo es segura en modo serial (workers: 1).
let studentsPage: StudentsPage;

type Guardado = {
  firstName: string;
  lastName: string;
  documentId: string;
  phone: string;
  subscriptionEndDate: string;
  freezeEndDate?: string;
};

const guardados = async () => {
  await studentsPage.page.waitForTimeout(300);
  return (await lsGet<Guardado[]>(studentsPage.page, 'students')) ?? [];
};

const guardadoLlamado = async (nombre: string) => {
  const estudiante = (await guardados()).find((s) => `${s.firstName} ${s.lastName}` === nombre);
  if (!estudiante) throw new Error(`No existe el estudiante "${nombre}"`);
  return estudiante;
};

/** Vigencia del estudiante sembrado: fija durante el escenario, relativa a hoy. */
const VENCIMIENTO_SEMBRADO = diasDesdeHoy(60);

/** Estudiante vigente con el nombre que indica el escenario. */
function estudianteLlamado(nombre: string) {
  const [firstName, ...resto] = nombre.split(' ');
  return { ...TEST_STUDENT, firstName, lastName: resto.join(' '), subscriptionEndDate: VENCIMIENTO_SEMBRADO };
}

/** Estudiante con la suscripción vencida (Pedro Ruiz). */
const OVERDUE_STUDENT = {
  ...TEST_STUDENT,
  id: 'stu-e2e-overdue',
  firstName: 'Pedro',
  lastName: 'Ruiz',
  documentId: '5555000011',
  email: 'pedro.ruiz@test.com',
  planName: 'Estándar',
  subscriptionEndDate: diasDesdeHoy(-5),
  status: 'active',
};

/** Estudiante con un pago que tiene comprobante GOP-0001. */
const STUDENT_WITH_PAYMENT = {
  ...TEST_STUDENT,
  id: 'stu-e2e-receipt',
  firstName: 'Marta',
  lastName: 'Díaz',
  documentId: '4040404040',
  email: 'marta.diaz@test.com',
  payments: [
    {
      id: 'pay-e2e-001',
      date: '2025-06-15',
      amount: 95000,
      method: 'Efectivo',
      status: 'paid',
      planName: 'Estándar',
      category: 'mensualidad',
      discount: 0,
      discountReason: '',
      receiptNo: 'GOP-0001',
    },
  ],
};

// ── Given ──────────────────────────────────────────────────────────────────────

Given('que existe el estudiante {string} registrado', async ({ page }, nombre: string) => {
  await seedAll(page, { students: [estudianteLlamado(nombre)] });
  studentsPage = new StudentsPage(page);
});

Given(
  'que existe un estudiante {string} con la suscripción vencida',
  async ({ page }, nombre: string) => {
    await seedAll(page, { students: [conNombre(OVERDUE_STUDENT, nombre)] });
    studentsPage = new StudentsPage(page);
  },
);

Given(
  'que existe un estudiante con un pago con comprobante {string}',
  async ({ page }, receiptNo: string) => {
    await seedAll(page, {
      students: [{ ...STUDENT_WITH_PAYMENT, payments: [{ ...STUDENT_WITH_PAYMENT.payments[0], receiptNo }] }],
    });
    studentsPage = new StudentsPage(page);
  },
);

// ── When ─────────────────────────────────────────────────────────────────────

When('accede al módulo de estudiantes', async ({ page }) => {
  studentsPage = new StudentsPage(page);
  await studentsPage.goto();
});

When('accede al perfil de ese estudiante', async ({ page }) => {
  studentsPage = new StudentsPage(page);
  await studentsPage.gotoPerfil(STUDENT_WITH_PAYMENT.id);
});

When('abre el formulario de nuevo estudiante', async ({}) => {
  await studentsPage.abrirFormularioNuevoEstudiante();
});

When(
  'registra al estudiante {string} {string} con documento {string} plan {string} y vencimiento en {int} días',
  async ({}, nombres: string, apellidos: string, documento: string, plan: string, dias: number) => {
    await studentsPage.registrarEstudiante({
      nombres,
      apellidos,
      documento,
      plan: new RegExp(plan, 'i'),
      vencimiento: diasDesdeHoy(dias),
    });
  },
);

When('busca {string}', async ({}, termino: string) => {
  await studentsPage.buscar(termino);
});

When(
  'intenta registrar un estudiante con {string} igual a {string}',
  async ({}, campo: string, valor: string) => {
    await studentsPage.abrirFormularioNuevoEstudiante();
    await studentsPage.registrarConCampo(campo, valor.replaceAll('␠', ' '), diasDesdeHoy(30));
  },
);

When('intenta registrar otro estudiante con el documento de {string}', async ({}, nombre: string) => {
  await studentsPage.abrirFormularioNuevoEstudiante();
  await studentsPage.registrarConCampo('Documento', (await guardadoLlamado(nombre)).documentId, diasDesdeHoy(30));
});

When('accede al perfil del estudiante {string}', async ({ page }, id: string) => {
  studentsPage = new StudentsPage(page);
  await studentsPage.gotoPerfil(id);
});

When('cambia el teléfono de {string} a {string}', async ({}, nombre: string, telefono: string) => {
  await studentsPage.abrirPerfilDe(nombre);
  await studentsPage.dialog.getByRole('button', { name: 'Editar' }).click();
  await studentsPage.llenarCampo(/teléfono/i, telefono);
  await studentsPage.btnGuardar.click();
});

When(
  'intenta congelar a {string} con motivo {string} por {string} días',
  async ({}, nombre: string, motivo: string, dias: string) => {
    await studentsPage.abrirPerfilDe(nombre);
    await studentsPage.dialog.getByRole('button', { name: 'Congelar' }).click();
    await studentsPage.page.locator('#freeze-reason').fill(motivo);
    await studentsPage.page.locator('#freeze-days').fill(dias);
    await studentsPage.page.getByRole('dialog').getByRole('button', { name: /congelar/i }).last().click();
  },
);

When('intenta eliminar a {string} y cancela', async ({}, nombre: string) => {
  await studentsPage.abrirPerfilDe(nombre);
  await studentsPage.dialog.getByRole('button', { name: 'Eliminar' }).click();
  await studentsPage.page.getByRole('dialog').getByRole('button', { name: /cancelar/i }).click();
});

// ── Then ─────────────────────────────────────────────────────────────────────

Then('debería ver el encabezado del módulo de estudiantes', async ({}) => {
  await expect(studentsPage.heading).toBeVisible();
});

Then('debería ver a {string} en la lista de estudiantes', async ({}, nombre: string) => {
  await expect(studentsPage.nombreEnLista(nombre)).toBeVisible();
});

Then('debería ver el mensaje de que no hay estudiantes que coincidan', async ({}) => {
  await expect(studentsPage.mensajeSinResultados).toBeVisible();
});

Then('debería ver la confirmación de que el estudiante fue registrado', async ({}) => {
  await expect(studentsPage.page.getByText(/estudiante registrado/i)).toBeVisible();
});

Then('el estado de pago de {string} debería ser {string}', async ({}, nombre: string, estado: string) => {
  await expect(studentsPage.filaEstudiante(nombre).getByTestId(/^payment-badge-/)).toHaveText(new RegExp(estado, 'i'));
});

Then('debería existir {int} estudiante guardado con documento {string}', async ({}, n: number, doc: string) => {
  expect((await guardados()).filter((s) => s.documentId === doc)).toHaveLength(n);
});

Then('debería existir solo {int} estudiante guardado', async ({}, n: number) => {
  expect(await guardados()).toHaveLength(n);
});

Then('no debería existir ningún estudiante guardado', async ({}) => {
  expect(await guardados()).toHaveLength(0);
});

Then('el formulario de estudiante debería seguir abierto mostrando un error', async ({}) => {
  await expect(studentsPage.dialog).toBeVisible();
  // Vale el mensaje del formulario o la validación nativa del navegador (type=email).
  await expect(studentsPage.dialog.locator('[data-slot="form-message"], input:invalid').first()).toBeVisible();
});

Then('no debería haberse ejecutado código inyectado', async ({ page }) => {
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as Window & { __xss?: number }).__xss)).toBeUndefined();
});

Then('debería ver que el estudiante no fue encontrado', async ({ page }) => {
  await expect(page.getByText(/no se encontró un estudiante/i)).toBeVisible();
});

Then('el teléfono guardado debería ser {string}', async ({}, telefono: string) => {
  expect((await guardados())[0].phone).toBe(telefono);
});

Then('el vencimiento de {string} debería seguir igual', async ({}, nombre: string) => {
  expect((await guardadoLlamado(nombre)).subscriptionEndDate).toBe(VENCIMIENTO_SEMBRADO);
});

When('elimina a {string} confirmando la acción', async ({}, nombre: string) => {
  await studentsPage.abrirPerfilDe(nombre);
  await studentsPage.dialog.getByRole('button', { name: 'Eliminar' }).click();
  await studentsPage.page.getByRole('dialog').getByRole('button', { name: /eliminar/i }).last().click();
});

Then('{string} debería quedar congelada', async ({}, nombre: string) => {
  expect((await guardadoLlamado(nombre)).freezeEndDate).toBeTruthy();
});

Then('el vencimiento de {string} debería correrse {int} días', async ({}, nombre: string, dias: number) => {
  const esperado = new Date(`${VENCIMIENTO_SEMBRADO}T12:00:00Z`);
  esperado.setUTCDate(esperado.getUTCDate() + dias);
  expect((await guardadoLlamado(nombre)).subscriptionEndDate).toBe(esperado.toISOString().slice(0, 10));
});

Then('{string} no debería quedar congelada', async ({}, nombre: string) => {
  expect((await guardadoLlamado(nombre)).freezeEndDate).toBeFalsy();
});

Then('debería ver el historial de pagos del estudiante', async ({}) => {
  await expect(studentsPage.headingHistorialPagos).toBeVisible();
});

Then(
  'al descargar el comprobante {string} el archivo debería cumplir el patrón {string}',
  async ({ page }, receiptNo: string, patron: string) => {
    // Intercepta el evento de descarga que dispara ReceiptService.generateAndDownload.
    const downloadPromise = page.waitForEvent('download');
    await studentsPage.botonDescargarComprobante(receiptNo).click();
    const download = await downloadPromise;

    const filename = download.suggestedFilename();

    // Convierte el patrón glob ("comprobante_GOP-*.pdf") a RegExp y valida.
    const regex = new RegExp(
      '^' + patron.replace(/[.]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );
    expect(filename).toMatch(regex);
    // Además, verificación estricta del comprobante concreto.
    expect(filename).toBe(`comprobante_${receiptNo}.pdf`);
  },
);
