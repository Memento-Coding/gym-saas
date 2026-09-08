/**
 * step-definitions/estudiantes.steps.ts
 * Steps para: features/estudiantes/gestion-estudiantes.feature
 */

import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { StudentsPage } from '../pages/StudentsPage';
import { TEST_STUDENT } from '../fixtures/students';
import { seedAll } from '../helpers/seed';

// playwright-bdd crea una instancia nueva de los steps por escenario;
// la variable de módulo es segura en modo serial (workers: 1).
let studentsPage: StudentsPage;

/** Fecha ISO relativa a hoy. días > 0 → futuro, < 0 → pasado. */
function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
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
  subscriptionEndDate: daysFromToday(-5),
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

Given('que existe el estudiante {string} registrado', async ({ page }, _nombre: string) => {
  await seedAll(page, { students: [TEST_STUDENT] });
  studentsPage = new StudentsPage(page);
});

Given(
  'que existe un estudiante {string} con la suscripción vencida',
  async ({ page }, _nombre: string) => {
    await seedAll(page, { students: [OVERDUE_STUDENT] });
    studentsPage = new StudentsPage(page);
  },
);

Given(
  'que existe un estudiante con un pago con comprobante {string}',
  async ({ page }, _receiptNo: string) => {
    await seedAll(page, { students: [STUDENT_WITH_PAYMENT] });
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
  'registra al estudiante {string} {string} con documento {string} plan {string} y vencimiento {string}',
  async ({}, nombres: string, apellidos: string, documento: string, plan: string, vencimiento: string) => {
    await studentsPage.registrarEstudiante({
      nombres,
      apellidos,
      documento,
      plan: new RegExp(plan, 'i'),
      vencimiento,
    });
  },
);

When('busca {string}', async ({}, termino: string) => {
  await studentsPage.buscar(termino);
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

Then('el estado de pago de {string} debería ser {string}', async ({}, _nombre: string, estado: string) => {
  await expect(studentsPage.badgePago('stu-e2e-overdue')).toHaveText(new RegExp(estado, 'i'));
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
