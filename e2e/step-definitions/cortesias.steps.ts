/**
 * step-definitions/cortesias.steps.ts
 * Steps para: features/cortesias/gestion-cortesias.feature
 */

import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { CourtesiesPage } from '../pages/CourtesiesPage';
import { TEST_STUDENT } from '../fixtures/students';
import { seedAll, lsGet } from '../helpers/seed';

// ── Estado compartido dentro del escenario ────────────────────────────────────
// Nota: playwright-bdd crea una instancia nueva de los steps por cada escenario,
// por lo que esta variable es segura en modo serial (workers: 1).

let courtesiesPage: CourtesiesPage;

// ── Antecedentes / Given ──────────────────────────────────────────────────────

Given('que existe el estudiante {string} en el sistema', async ({ page }, _nombre: string) => {
  await seedAll(page, { students: [TEST_STUDENT] });
  courtesiesPage = new CourtesiesPage(page);
});

Given(
  'que "Ana García" tiene membresía vigente hasta {string}',
  async ({ page }, fechaFin: string) => {
    await seedAll(page, {
      students: [{ ...TEST_STUDENT, subscriptionEndDate: fechaFin }],
    });
    courtesiesPage = new CourtesiesPage(page);
  },
);

Given(
  'que "Ana García" tiene un bono activo vigente con razón {string}',
  async ({ page }, razon: string) => {
    const futureEnd = new Date(Date.now() + 14 * 86_400_000)
      .toISOString()
      .split('T')[0];
    await seedAll(page, {
      students: [
        {
          ...TEST_STUDENT,
          courtesyBonuses: [
            {
              id: 'bonus-e2e-activo',
              startDate: new Date().toISOString().split('T')[0],
              endDate: futureEnd,
              reason: razon,
              weeks: 2,
            },
          ],
        },
      ],
    });
    courtesiesPage = new CourtesiesPage(page);
  },
);

Given(
  'que "Ana García" tiene un bono registrado con razón {string}',
  async ({ page }, razon: string) => {
    await seedAll(page, {
      students: [
        {
          ...TEST_STUDENT,
          courtesyBonuses: [
            {
              id: 'bonus-e2e-eliminar',
              startDate: '2025-01-01',
              endDate: '2025-01-15',
              reason: razon,
              weeks: 2,
            },
          ],
        },
      ],
    });
    courtesiesPage = new CourtesiesPage(page);
  },
);

// ── When ──────────────────────────────────────────────────────────────────────

When('accede al módulo de cortesías', async ({ page }) => {
  // Siempre creamos instancia nueva con la page activa del escenario
  courtesiesPage = new CourtesiesPage(page);
  await courtesiesPage.goto();
});

When('hace clic en el botón de nuevo bono', async ({}) => {
  await courtesiesPage.abrirDialogoNuevoBono();
});

When(
  'registra un bono de cortesía para {string} de {int} semanas con razón {string}',
  async ({}, nombreEstudiante: string, semanas: number, razon: string) => {
    await courtesiesPage.abrirDialogoNuevoBono();
    await courtesiesPage.seleccionarEstudiante(nombreEstudiante);
    await courtesiesPage.llenarFormularioBono({
      fechaInicio: '2025-03-01',
      duracionSemanas: semanas,
      razon,
    });
    await courtesiesPage.registrarBono();
  },
);

When('elimina el bono con razón {string}', async ({}, razon: string) => {
  await courtesiesPage.eliminarBono(razon);
});

// ── Then ──────────────────────────────────────────────────────────────────────

Then('debería ver el encabezado del módulo', async ({}) => {
  await expect(courtesiesPage.heading).toBeVisible();
});

Then('debería ver el mensaje de que no hay bonos registrados', async ({}) => {
  await expect(courtesiesPage.mensajeSinBonos).toBeVisible();
});

Then('debería ver el diálogo de registro', async ({}) => {
  await expect(courtesiesPage.dialog).toBeVisible();
});

Then('debería ver el selector de estudiante en el formulario', async ({}) => {
  await expect(courtesiesPage.dialogSelectEstudiante).toBeVisible();
});

Then('el bono debería aparecer agrupado bajo {string}', async ({}, nombre: string) => {
  // Buscamos el nombre dentro de un card-title (heading del grupo), no en el select value
  await expect(
    courtesiesPage.page.locator('[data-slot="card-title"]').filter({ hasText: nombre }),
  ).toBeVisible();
});

Then('debería ver la razón {string} en la lista', async ({}, razon: string) => {
  await expect(courtesiesPage.textoBono(razon)).toBeVisible();
});

Then(
  'la fecha de vencimiento de membresía de {string} debe seguir siendo {string}',
  async ({ page }, _nombre: string, fechaEsperada: string) => {
    const students = await lsGet<Array<{ subscriptionEndDate: string }>>(page, 'students');
    expect(students?.[0]?.subscriptionEndDate).toBe(fechaEsperada);
  },
);

Then('el bono debería mostrar el badge {string}', async ({}, badge: string) => {
  await expect(courtesiesPage.badgeEstado(badge)).toBeVisible();
});

Then('ese bono no debería aparecer en la lista', async ({}) => {
  await expect(courtesiesPage.page.getByTitle(/eliminar bono/i)).not.toBeVisible();
});
