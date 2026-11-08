/**
 * step-definitions/cortesias.steps.ts
 * Steps para: features/cortesias/gestion-cortesias.feature
 */

import { expect, type Page } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { CourtesiesPage } from '../pages/CourtesiesPage';
import { TEST_STUDENT } from '../fixtures/students';
import { seedAll, lsGet } from '../helpers/seed';
import { diasDesdeHoy } from '../helpers/dates';

// ── Estado compartido dentro del escenario ────────────────────────────────────
// Nota: playwright-bdd crea una instancia nueva de los steps por cada escenario,
// por lo que esta variable es segura en modo serial (workers: 1).

let courtesiesPage: CourtesiesPage;
let vencimientoInicial: string;

// ── Antecedentes / Given ──────────────────────────────────────────────────────

Given('que existe el estudiante {string} en el sistema', async ({ page }, nombre: string) => {
  const [firstName, ...resto] = nombre.split(' ');
  await seedAll(page, { students: [{ ...TEST_STUDENT, firstName, lastName: resto.join(' ') }] });
  courtesiesPage = new CourtesiesPage(page);
});

Given(
  'que "Ana García" tiene membresía vigente por {int} días más',
  async ({ page }, dias: number) => {
    vencimientoInicial = diasDesdeHoy(dias);
    await seedAll(page, {
      students: [{ ...TEST_STUDENT, subscriptionEndDate: vencimientoInicial }],
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

When('empieza a registrar un bono', async ({}) => {
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
  'la fecha de vencimiento de membresía de {string} debería seguir igual',
  async ({ page }, nombre: string) => {
    const students = await lsGet<Array<{ firstName: string; lastName: string; subscriptionEndDate: string }>>(page, 'students');
    const estudiante = students?.find((s) => `${s.firstName} ${s.lastName}` === nombre);
    expect(estudiante?.subscriptionEndDate).toBe(vencimientoInicial);
  },
);

When(
  'intenta registrar para {string} un bono de {string} semanas con razón {string}',
  async ({ page }, nombre: string, semanas: string, razon: string) => {
    await courtesiesPage.abrirDialogoNuevoBono();
    await courtesiesPage.seleccionarEstudiante(nombre);
    await page.getByLabel(/fecha de inicio/i).fill(diasDesdeHoy(1));
    await page.getByLabel(/duración/i).fill(semanas);
    await page.getByLabel(/razón/i).fill(razon);
    await registrarSiSePuede();
  },
);

When('intenta registrar un bono sin elegir estudiante', async ({ page }) => {
  await courtesiesPage.abrirDialogoNuevoBono();
  await page.getByLabel(/fecha de inicio/i).fill(diasDesdeHoy(1));
  await page.getByLabel(/duración/i).fill('2');
  await page.getByLabel(/razón/i).fill('Sin estudiante E2E');
  await registrarSiSePuede();
});

/** Un botón deshabilitado ya es un rechazo válido: el escenario verifica que no se guardó nada. */
async function registrarSiSePuede() {
  if (await courtesiesPage.dialogBtnRegistrar.isEnabled()) await courtesiesPage.registrarBono();
}

const bonosGuardados = async (page: Page) => {
  await page.waitForTimeout(300);
  const students = await lsGet<Array<{ courtesyBonuses?: unknown[] }>>(page, 'students');
  return students?.[0]?.courtesyBonuses ?? [];
};

Then('no debería existir ningún bono guardado', async ({ page }) => {
  expect(await bonosGuardados(page)).toHaveLength(0);
});

Then('deberían existir {int} bonos guardados', async ({ page }, n: number) => {
  expect(await bonosGuardados(page)).toHaveLength(n);
});

Then('el formulario de bono debería seguir abierto', async ({ page }) => {
  await expect(page.getByRole('dialog')).toBeVisible();
});

Then('el bono debería mostrar el badge {string}', async ({}, badge: string) => {
  await expect(courtesiesPage.badgeEstado(badge)).toBeVisible();
});

Then('ese bono no debería aparecer en la lista', async ({}) => {
  await expect(courtesiesPage.page.getByTitle(/eliminar bono/i)).not.toBeVisible();
});
