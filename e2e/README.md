# Pruebas E2E — BDD con Playwright

Guía completa para ejecutar, entender y extender el suite de pruebas E2E del proyecto.

---

## Tabla de contenidos

1. [Stack tecnológico](#stack-tecnológico)
2. [Estructura de carpetas](#estructura-de-carpetas)
3. [Cómo funciona la arquitectura BDD](#cómo-funciona-la-arquitectura-bdd)
4. [Ejecutar las pruebas](#ejecutar-las-pruebas)
   - [Comandos disponibles](#comandos-disponibles)
   - [Modo lento (ver cada acción)](#modo-lento-ver-cada-acción)
   - [Modo UI (recomendado para revisar)](#modo-ui-recomendado-para-revisar)
   - [Modo debug (paso a paso)](#modo-debug-paso-a-paso)
   - [Filtrar por tag o módulo](#filtrar-por-tag-o-módulo)
5. [Estrategia de tags](#estrategia-de-tags)
6. [Agregar un nuevo módulo](#agregar-un-nuevo-módulo)
   - [Paso 1 — Crear el archivo `.feature`](#paso-1--crear-el-archivo-feature)
   - [Paso 2 — Crear el Page Object](#paso-2--crear-el-page-object)
   - [Paso 3 — Crear los step definitions](#paso-3--crear-los-step-definitions)
   - [Paso 4 — Regenerar y verificar](#paso-4--regenerar-y-verificar)
7. [Agregar fixtures de datos](#agregar-fixtures-de-datos)
8. [Reglas de escritura de escenarios](#reglas-de-escritura-de-escenarios)
9. [Referencia de step definitions existentes](#referencia-de-step-definitions-existentes)
10. [Solución de problemas frecuentes](#solución-de-problemas-frecuentes)

---

## Stack tecnológico

| Herramienta | Versión | Rol |
|---|---|---|
| `@playwright/test` | ^1.62 | Runner de tests y automatización del browser |
| `playwright-bdd` | ^9 | Puente entre Gherkin y Playwright |
| `@cucumber/cucumber` | ^11 | Parser de archivos `.feature` |

El flujo es:

```
archivo .feature (Gherkin)
        ↓  bddgen
spec .js generado en .features-gen/
        ↓  playwright test
ejecuta step definitions
        ↓
Page Objects interactúan con la app
```

---

## Estructura de carpetas

```
e2e/
├── features/                       # Los QUÉ — escenarios en lenguaje natural
│   ├── ajustes/
│   │   └── configuracion-sistema.feature
│   ├── comunicacion/
│   │   └── gestion-comunicacion.feature
│   ├── consentimiento/
│   │   └── gestion-consentimientos.feature
│   └── cortesias/
│       └── gestion-cortesias.feature
│
├── step-definitions/               # Los CÓMO — conectan Gherkin con automatización
│   ├── ajustes.steps.ts
│   ├── comunicacion.steps.ts
│   ├── consentimiento.steps.ts
│   └── cortesias.steps.ts
│
├── pages/                          # Page Objects — interacción con la UI
│   ├── CourtesiesPage.ts
│   ├── ConsentPage.ts
│   ├── CommunicationPage.ts
│   └── SettingsPage.ts
│
├── fixtures/                       # Datos de prueba reutilizables
│   ├── students.ts                 # TEST_STUDENT, TEST_MINOR_STUDENT
│   ├── consent.ts
│   ├── communication.ts
│   └── index.ts
│
├── helpers/
│   └── seed.ts                     # seedAll() y lsGet() — manejo de localStorage
│
├── support/
│   └── world.ts                    # Fixtures de Playwright-BDD (test, Given, When, Then)
│
└── README.md                       # Este archivo
```

Los archivos en `.features-gen/` son **generados automáticamente** por `bddgen` — no los edites manualmente.

---

## Cómo funciona la arquitectura BDD

### Variables de entorno necesarias

El archivo `.env.development` ya tiene las dos variables que hacen posibles los tests:

```
VITE_AUTH_BYPASS=true         # Salta la autenticación de Cognito
VITE_E2E_STORAGE=localStorage # Fuerza el uso de localStorage en vez de IndexedDB
```

### Estrategia de seed de datos

Cada test siembra sus propios datos en `localStorage` **antes** de que cargue la app, usando `seedAll()`:

```typescript
// En el step definition, antes de page.goto()
await seedAll(page, {
  students: [TEST_STUDENT],
  consent_config: DEFAULT_CONSENT_CONFIG,
});
```

Todas las claves se almacenan con el prefijo `gymops:` — por ejemplo `gymops:students`.

Para verificar datos persistidos **después** de una acción, se usa `lsGet()`:

```typescript
const students = await lsGet<Student[]>(page, 'students');
expect(students?.[0]?.subscriptionEndDate).toBe('2025-12-31');
```

---

## Ejecutar las pruebas

### Comandos disponibles

```bash
# Generar los spec files (necesario si cambiaste features o steps)
npm run bdd:gen

# Ejecutar todos los tests (headless, sin browser visible)
npm run bdd:test

# Ejecutar con browser visible, velocidad normal
npm run bdd:headed

# Solo pruebas @smoke
npm run bdd:smoke

# Solo pruebas @critico
npm run bdd:critico

# Solo pruebas @regresion
npm run bdd:regresion

# Solo un módulo específico
npm run bdd:cortesias
npm run bdd:consentimiento
npm run bdd:comunicacion
npm run bdd:ajustes

# Abrir el reporte HTML de la última ejecución
npm run bdd:report
```

### Modo lento (ver cada acción)

El parámetro `SLOW_MO` agrega un delay en milisegundos **entre cada acción individual** del browser (clicks, fills, navegaciones):

```bash
# 1.5 segundos entre cada acción — cómodo para seguir lo que pasa
npm run bdd:slow

# 5 segundos entre cada acción — para ver con detalle
npm run bdd:veryslow

# Valor personalizado (en ms)
SLOW_MO=2000 npx playwright test --headed

# Solo un módulo lento
SLOW_MO=2000 npx playwright test --headed --grep @cortesias

# Solo un escenario lento
SLOW_MO=3000 npx playwright test --headed --grep "registra un bono"
```

> **Nota:** `SLOW_MO` aplica entre acciones individuales del browser, no entre pasos Gherkin completos. Si un paso hace 3 acciones (click + fill + click), habrá 3 pausas.

### Modo UI (recomendado para revisar)

El modo UI es la forma más cómoda de revisar y depurar las pruebas. Abre una ventana con:

- **Panel izquierdo**: árbol de todos los tests con sus tags — puedes ejecutar uno a la vez
- **Panel central**: el browser en tiempo real
- **Panel inferior**: traza paso a paso — puedes hacer click en cada `Given/When/Then` y ver el snapshot del DOM en ese momento exacto

```bash
# Abrir la interfaz UI
npm run bdd:ui

# O directamente
npx playwright test --ui
```

Desde la UI puedes:
- Ejecutar un solo test haciendo click en él
- Hacer replay de cualquier test anterior
- Ver qué locator se usó en cada acción
- Ver capturas de pantalla automáticas en cada paso
- Filtrar por tag o nombre de test

### Modo debug (paso a paso)

Abre el **Playwright Inspector** donde puedes avanzar paso a paso, ejecutar locators manualmente y ver el DOM en vivo:

```bash
npm run bdd:debug

# Debug de un test específico
npx playwright test --debug --grep "registra un bono"
```

En el Inspector puedes:
- Pausar en cualquier punto con el botón ⏸
- Avanzar acción por acción con ▶
- Escribir locators en la barra de búsqueda para probarlos en vivo
- Ver el highlight del elemento en el browser

### Filtrar por tag o módulo

```bash
# Por tag
npx playwright test --grep @smoke
npx playwright test --grep @critico
npx playwright test --grep @regresion
npx playwright test --grep @e2e

# Por módulo (tag)
npx playwright test --grep @cortesias
npx playwright test --grep @ajustes

# Por nombre de escenario (substring)
npx playwright test --grep "registra un bono"
npx playwright test --grep "no modifica la fecha"

# Excluir un tag
npx playwright test --grep-invert @regresion

# Combinaciones (AND no está soportado nativamente, usar módulo + tag)
npx playwright test --grep @critico e2e/features/cortesias/
```

---

## Estrategia de tags

Cada escenario tiene dos tipos de tags:

| Tag | Tipo | Descripción |
|---|---|---|
| `@e2e` | Global | Todos los escenarios BDD |
| `@cortesias` | Módulo | Escenarios del módulo de cortesías |
| `@consentimiento` | Módulo | Escenarios del módulo de consentimiento |
| `@comunicacion` | Módulo | Escenarios del módulo de comunicación |
| `@ajustes` | Módulo | Escenarios del módulo de ajustes |
| `@smoke` | Tipo | Prueba básica de que el módulo carga y funciona |
| `@critico` | Tipo | Flujo de negocio principal — debe pasar siempre |
| `@regresion` | Tipo | Casos de borde y comportamientos secundarios |

### Cuándo usar cada tag de tipo

- **`@smoke`** — La prueba mínima que verifica que el módulo abre y muestra lo esperado. Ideal para pipelines de CI rápidos.
- **`@critico`** — El flujo principal del caso de uso. Si falla, el módulo está roto.
- **`@regresion`** — Casos específicos que alguna vez fallaron o que cubren variantes del flujo principal.

---

## Agregar un nuevo módulo

Ejemplo completo agregando el módulo de **Estudiantes** (`/estudiantes`).

### Paso 1 — Crear el archivo `.feature`

Crea `e2e/features/estudiantes/gestion-estudiantes.feature`:

```gherkin
# language: es
@e2e @estudiantes
Característica: Gestión de estudiantes
  Como administrador del gimnasio
  Quiero registrar y consultar estudiantes
  Para mantener un directorio actualizado de los miembros del gimnasio

  @smoke
  Escenario: Administrador consulta la lista de estudiantes
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Entonces debería ver a "Ana García" en la lista

  @critico
  Escenario: Administrador registra un nuevo estudiante
    Cuando accede al módulo de estudiantes
    Y hace clic en el botón de nuevo estudiante
    Y completa el formulario con los datos de "Carlos López"
    Entonces "Carlos López" debería aparecer en la lista de estudiantes

  @regresion
  Escenario: Administrador consulta el perfil de un estudiante
    Dado que existe el estudiante "Ana García" registrado
    Cuando accede al módulo de estudiantes
    Y hace clic en el nombre de "Ana García"
    Entonces debería ver el perfil completo de "Ana García"
```

**Reglas para escribir buenos escenarios:**

- La primera línea debe ser `# language: es`
- Los tags van antes de `Característica:` (aplican a todos) o antes de `Escenario:` (solo a ese)
- Usar `Antecedentes:` para pasos que se repiten en todos los escenarios del feature
- Los pasos deben describir **qué** hace el usuario, no **cómo** lo hace técnicamente
- Evitar detalles como "hace clic en el botón con id X" — preferir "confirma el registro"

### Paso 2 — Crear el Page Object

Crea `e2e/pages/StudentsPage.ts`:

```typescript
import type { Page } from '@playwright/test';

export class StudentsPage {
  constructor(private readonly page: Page) {}

  // ── Navegación ──────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto('/estudiantes');
    await this.page.waitForLoadState('load');
  }

  // ── Locators ────────────────────────────────────────────────────────────────

  get btnNuevoEstudiante() {
    return this.page.getByRole('button', { name: /nuevo estudiante/i });
  }

  nombreEnLista(nombre: string) {
    return this.page.getByText(nombre, { exact: true });
  }

  // ── Acciones ────────────────────────────────────────────────────────────────

  async abrirFormularioNuevoEstudiante() {
    await this.btnNuevoEstudiante.click();
  }

  async irAlPerfilDe(nombre: string) {
    await this.nombreEnLista(nombre).click();
  }
}
```

**Convenciones del Page Object:**

- Un archivo por página/módulo
- Secciones: Navegación → Locators → Acciones
- Los `get` son propiedades (locators sin parámetros)
- Los métodos con parámetros reciben el texto/dato a buscar
- Los locators usan preferentemente `getByRole` y `getByLabel` — son más robustos que los selectores CSS
- Nunca pongas `expect()` dentro del Page Object — eso va en los step definitions

### Paso 3 — Crear los step definitions

Crea `e2e/step-definitions/estudiantes.steps.ts`:

```typescript
import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/world';
import { StudentsPage } from '../pages/StudentsPage';
import { TEST_STUDENT } from '../fixtures/students';
import { seedAll } from '../helpers/seed';

let studentsPage: StudentsPage;

// ── Given ──────────────────────────────────────────────────────────────────────

Given('que existe el estudiante {string} registrado', async ({ page }, _nombre: string) => {
  await seedAll(page, { students: [TEST_STUDENT] });
  studentsPage = new StudentsPage(page);
});

// ── When ───────────────────────────────────────────────────────────────────────

When('accede al módulo de estudiantes', async ({ page }) => {
  // Siempre crear instancia nueva con la page activa
  studentsPage = new StudentsPage(page);
  await studentsPage.goto();
});

When('hace clic en el botón de nuevo estudiante', async ({}) => {
  await studentsPage.abrirFormularioNuevoEstudiante();
});

// ── Then ───────────────────────────────────────────────────────────────────────

Then('debería ver a {string} en la lista', async ({}, nombre: string) => {
  await expect(studentsPage.nombreEnLista(nombre)).toBeVisible();
});
```

**Reglas críticas para los step definitions:**

- El primer argumento **siempre** debe ser destructuring: `async ({ page }, ...)` — nunca `async (fixtures, ...)`
- El step `When` de navegación principal **siempre** crea una instancia nueva del Page Object: `studentsPage = new StudentsPage(page)` — no uses `if (!studentsPage)`
- Los pasos `Given` que siembran datos también crean la instancia del Page Object
- Los `Then` de verificación usan `expect()` de Playwright, nunca assertions de vitest/jest
- Usar `async ({})` cuando el step no necesita fixtures

### Paso 4 — Regenerar y verificar

```bash
# 1. Regenerar los spec files
npm run bdd:gen

# 2. Verificar que los tests se detectan
npx playwright test --list | grep estudiantes

# 3. Ejecutar solo el nuevo módulo
npx playwright test --headed --grep @estudiantes

# 4. Si quieres verlo más despacio
SLOW_MO=1500 npx playwright test --headed --grep @estudiantes
```

Si `bddgen` da error de **"Missing step definition"**, significa que hay un paso en el `.feature` que no tiene su correspondiente función `Given/When/Then` en los steps. El error te dice exactamente qué paso falta.

Si `bddgen` da error de **"Multiple definitions matched"**, hay dos funciones con el mismo patrón. Renombra una o hazla más específica.

---

## Agregar fixtures de datos

Si el nuevo módulo necesita datos de prueba propios, crea `e2e/fixtures/estudiantes.ts`:

```typescript
export const TEST_PLAN = {
  id: 'plan-e2e-001',
  name: 'Estándar E2E',
  price: 95000,
  category: 'mensualidad',
};
```

Y expórtalo desde `e2e/fixtures/index.ts`:

```typescript
export * from './students';
export * from './consent';
export * from './communication';
export * from './estudiantes';  // ← agregar esta línea
```

### Claves de localStorage disponibles

El `StorageService` usa el prefijo `gymops:`. Las claves que la app reconoce:

| Clave | Tipo de dato |
|---|---|
| `students` | `Student[]` |
| `consent_config` | `ConsentConfig` |
| `communication_config` | `CommunicationConfig` |
| `branding` | `BrandingConfig` |
| `formFields` | `FormField[]` |

Para ver el dato que guardó la app después de una acción:

```typescript
const students = await lsGet<Student[]>(page, 'students');
console.log(students);
```

---

## Reglas de escritura de escenarios

### ✅ Hacer

```gherkin
Escenario: Administrador registra un bono que no afecta la membresía
  Dado que "Ana García" tiene membresía vigente hasta "2025-12-31"
  Cuando registra un bono de cortesía de 4 semanas
  Entonces la fecha de vencimiento debe seguir siendo "2025-12-31"
```

- Escenarios independientes entre sí (cada uno siembra sus propios datos)
- Pasos que describen intención de negocio
- Un escenario por regla de negocio
- Nombres de escenario descriptivos del caso de uso

### ❌ Evitar

```gherkin
# Mal — describe clicks, no comportamiento de negocio
Escenario: Click en botón
  Cuando hago clic en el botón con clase "btn-primary"
  Entonces el div con id "result" es visible

# Mal — escenario demasiado largo que prueba varias cosas
Escenario: Flujo completo
  Dado que entro al sistema
  Cuando creo un estudiante
  Y creo un bono
  Y modifico la configuración
  Y descargo el backup
  Entonces todo funciona
```

---

## Referencia de step definitions existentes

### Cortesías (`@cortesias`)

| Step | Tipo |
|---|---|
| `que existe el estudiante {string} en el sistema` | Given |
| `que "Ana García" tiene membresía vigente hasta {string}` | Given |
| `que "Ana García" tiene un bono activo vigente con razón {string}` | Given |
| `que "Ana García" tiene un bono registrado con razón {string}` | Given |
| `accede al módulo de cortesías` | When |
| `hace clic en el botón de nuevo bono` | When |
| `registra un bono de cortesía para {string} de {int} semanas con razón {string}` | When |
| `elimina el bono con razón {string}` | When |
| `debería ver el encabezado del módulo` | Then |
| `debería ver el mensaje de que no hay bonos registrados` | Then |
| `el bono debería aparecer agrupado bajo {string}` | Then |
| `la fecha de vencimiento de membresía de {string} debe seguir siendo {string}` | Then |
| `el bono debería mostrar el badge {string}` | Then |

### Consentimiento (`@consentimiento`)

| Step | Tipo |
|---|---|
| `que existe una configuración de consentimiento en versión 1` | Given |
| `que el estudiante {string} no ha firmado el consentimiento` | Given |
| `que el estudiante {string} ha firmado el consentimiento en la versión vigente` | Given |
| `que el estudiante {string} es menor de edad y no ha firmado` | Given |
| `accede al módulo de consentimiento` | When |
| `guarda una nueva versión del texto de consentimiento` | When |
| `abre el diálogo de firma para {string}` | When |
| `debería ver el número de versión activa` | Then |
| `debería ver a {string} en la lista de pendientes` | Then |
| `debería ver el mensaje de que todos los estudiantes han firmado` | Then |
| `debería ver el canvas para capturar la firma` | Then |

### Comunicación (`@comunicacion`)

| Step | Tipo |
|---|---|
| `que existe un estudiante registrado` | Given |
| `accede al módulo de comunicación` | When |
| `navega a la pestaña de canales` | When |
| `navega a la pestaña de envío` | When |
| `edita la primera plantilla con el texto {string}` | When |
| `selecciona la plantilla {string}` | When |
| `debería ver la plantilla {string}` | Then |
| `el botón de enviar debería estar deshabilitado` | Then |
| `al previsualizar debería ver el nombre del estudiante resuelto en el mensaje` | Then |

### Ajustes (`@ajustes`)

| Step | Tipo |
|---|---|
| `que existe el campo personalizado {string} en el formulario` | Given |
| `que existe un estudiante y configuración de marca {string} en el sistema` | Given |
| `accede al módulo de ajustes` | When |
| `guarda el nombre {string} y el eslogan {string}` | When |
| `agrega el campo personalizado {string} al formulario` | When |
| `abre el diálogo de reinicio del sistema` | When |
| `ejecuta el reinicio completo del sistema` | When |
| `debería ver la confirmación de que la marca fue guardada` | Then |
| `el nombre del gimnasio guardado debería ser {string}` | Then |
| `la lista de estudiantes debería estar vacía` | Then |

---

## Solución de problemas frecuentes

### `bddgen` falla con "Missing step definition"

Hay un paso en el `.feature` que no tiene implementación. El error muestra exactamente qué línea falta. Agrega la función `Given/When/Then` correspondiente en el archivo de steps del módulo.

### `bddgen` falla con "First argument must use the object destructuring pattern"

El primer argumento de la función del step no usa destructuring. Cambia:

```typescript
// ❌ Incorrecto
Given('...', async (fixtures, nombre) => { ... })

// ✅ Correcto
Given('...', async ({ page }, nombre) => { ... })

// ✅ Correcto cuando no necesitas fixtures
Given('...', async ({}, nombre) => { ... })
```

### Los tests usan la `page` del test anterior (página cerrada)

El Page Object está siendo reutilizado entre escenarios via variable de módulo. El `When` de navegación **siempre** debe crear una instancia nueva:

```typescript
// ❌ Incorrecto — reutiliza la instancia con la page cerrada
When('accede al módulo', async ({ page }) => {
  if (!myPage) myPage = new MyPage(page);  // solo crea si no existe
  await myPage.goto();
});

// ✅ Correcto — siempre crea instancia nueva con la page activa
When('accede al módulo', async ({ page }) => {
  myPage = new MyPage(page);  // siempre nueva instancia
  await myPage.goto();
});
```

### `strict mode violation: getByText resolved to N elements`

El locator es demasiado amplio y encuentra múltiples elementos. Soluciones:

```typescript
// Usar exact match
page.getByText('Feliz cumpleaños', { exact: true })

// Limitar al scope de un elemento padre
page.locator('[data-slot="card-title"]').filter({ hasText: 'texto' })

// Usar un locator más específico
page.getByRole('heading', { name: 'texto' })
```

### Los tests pasan en CI pero fallan localmente (o viceversa)

Verificar que `.env.development` tiene:
```
VITE_AUTH_BYPASS=true
VITE_E2E_STORAGE=localStorage
```

Sin estas variables la app usa Cognito real e IndexedDB, y los seeds de `seedAll()` no funcionan.

### `BDD config not found for testDir`

Los spec files en `.features-gen/` son de una generación anterior. Regenerar:

```bash
rm -rf .features-gen
npm run bdd:gen
```
