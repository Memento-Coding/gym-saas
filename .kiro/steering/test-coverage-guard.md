---
inclusion: always
---

# Guardia de cobertura de pruebas

Cada módulo de la aplicación debe tener pruebas de integración. Este steering define el estado actual de cobertura y las reglas que debes aplicar siempre que trabajes en este proyecto.

---

## Mapa de módulos y cobertura actual

### Módulos con cobertura COMPLETA ✅

| Módulo | Servicio | Unit/Integration | E2E (BDD) |
|---|---|---|---|
| Consentimiento | `ConsentService.ts` | `src/services/ConsentService.test.ts` | `e2e/features/consentimiento/gestion-consentimientos.feature` |
| Comunicación | `CommunicationService.ts` | — | `e2e/features/comunicacion/gestion-comunicacion.feature` |
| Cortesías | `CourtesyService.ts` | — | `e2e/features/cortesias/gestion-cortesias.feature` |
| Ajustes | `BackupService.ts` + Settings | `src/services/BackupService.test.ts` | `e2e/features/ajustes/configuracion-sistema.feature` |
| Pagos | `PaymentService.ts` + `ReceiptService.ts` | `src/__tests__/payments/PaymentService.test.ts` + `ReceiptService.test.ts` | — |
| Finanzas | `FinanceService.ts` | `src/__tests__/FinanceService.test.ts` | — |
| Dashboard | `DashboardService.ts` | `src/__tests__/DashboardService.test.ts` | — |
| Storage | `StorageService.ts` | `src/services/storage/StorageService.test.ts` | — |
| Auth | `AuthService.ts` + `AuthProvider.tsx` | `src/services/auth/AuthService.test.ts` + `AuthProvider.test.tsx` + `ProtectedRoute.test.tsx` | — |

### Módulos con cobertura PARCIAL ⚠️

| Módulo | Servicio | Qué falta |
|---|---|---|
| Comunicación | `CommunicationService.ts` | Tests unitarios del servicio |
| Cortesías | `CourtesyService.ts` | Tests unitarios del servicio |
| Estudiantes | `StudentService.ts` | Tests unitarios + pruebas E2E |
| Membresía | `MembershipService.ts` | Tests unitarios |

### Módulos SIN cobertura ❌

| Módulo | Página | Qué falta |
|---|---|---|
| Estudiantes | `StudentsPage.tsx` + `StudentProfilePage.tsx` | Tests unitarios de `StudentService.ts` + feature E2E |
| Membresía | — | Tests unitarios de `MembershipService.ts` |
| Login / Registro | `LoginPage.tsx` + `RegisterPage.tsx` + `ForgotPasswordPage.tsx` | Feature E2E de autenticación |
| Finanzas | `FinancePage.tsx` | Feature E2E |
| Pagos | — | Feature E2E |
| Dashboard | `DashboardPage.tsx` | Feature E2E |

---

## Reglas que debes aplicar siempre

### Cuando implementes o modifiques un servicio

1. **Debe existir un archivo de test** en la misma carpeta o en `src/__tests__/` con el nombre `NombreServicio.test.ts`.
2. El test debe cubrir al menos:
   - El flujo principal (happy path)
   - Al menos un caso de error o borde
   - La persistencia en storage cuando aplique
3. Si el servicio ya tiene test, verifica que los cambios que hiciste no rompan los casos existentes y agrega casos nuevos si añadiste funcionalidad.

### Cuando implementes o modifiques una página

1. **Debe existir un archivo `.feature`** en `e2e/features/<nombre-modulo>/`.
2. El `.feature` debe tener al menos:
   - Un escenario `@smoke` que verifique que la página carga correctamente
   - Un escenario `@critico` para el flujo de negocio principal
3. Si la página ya tiene feature, verifica que los nuevos flujos estén cubiertos.

### Cuando agregues un módulo nuevo completo

Debes crear **los tres niveles** antes de considerar el módulo terminado:

```
src/services/NuevoServicio.ts          → lógica de negocio
src/services/NuevoServicio.test.ts     → tests unitarios/integración del servicio
src/pages/NuevaPage.tsx                → interfaz de usuario
e2e/features/nuevo/nuevo.feature       → escenarios BDD en Gherkin
e2e/pages/NuevaPage.ts                 → Page Object
e2e/step-definitions/nuevo.steps.ts   → step definitions
```

### Cuando hagas un PR o commit

Antes de proponer el commit, verifica mentalmente:

- ¿El módulo que modifiqué tiene test unitario?
- ¿El módulo que modifiqué tiene feature E2E?
- Si agregué funcionalidad nueva, ¿está reflejada en los tests existentes o agregué casos nuevos?
- ¿Los tests existentes siguen pasando con mis cambios?

Si alguna respuesta es NO, indícalo explícitamente al usuario y propón qué pruebas hacen falta antes de cerrar el trabajo.

---

## Convenciones de pruebas del proyecto

### Tests unitarios / integración (Vitest)

- **Runner:** Vitest con jsdom
- **Ubicación:** junto al servicio (`src/services/NombreServicio.test.ts`) o en `src/__tests__/`
- **Imports:** usar alias `@/` para imports de `src/`
- **Setup:** `src/setupTests.ts` configura jest-dom matchers
- **Storage en tests:** usar `LocalStorageAdapter` directamente o mockear `StorageService`
- **Ejemplo de estructura:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createStorageService, resetStorageService } from '@/services/storage/StorageService';

describe('NuevoServicio', () => {
  let storage: StorageService;
  let servicio: NuevoServicio;

  beforeEach(async () => {
    resetStorageService();
    storage = await createStorageService();
    servicio = new NuevoServicio(storage);
  });

  it('flujo principal', async () => {
    // arrange → act → assert
  });
});
```

### Pruebas E2E (Playwright BDD)

- **Runner:** `@playwright/test` + `playwright-bdd`
- **Lenguaje:** Gherkin en español
- **Ubicación features:** `e2e/features/<modulo>/`
- **Ubicación steps:** `e2e/step-definitions/<modulo>.steps.ts`
- **Page Objects:** `e2e/pages/<Modulo>Page.ts`
- **Fixtures de datos:** `e2e/fixtures/`
- **Seed de datos:** usar `seedAll(page, { clave: datos })` antes del `page.goto()`
- **Guía completa:** ver `e2e/README.md`

### Tags obligatorios en features E2E

Cada feature debe tener como mínimo:
- `@e2e` — en la Característica (aplica a todos los escenarios)
- `@<nombre-modulo>` — en la Característica (ej: `@estudiantes`)
- Al menos un escenario con `@smoke`
- Al menos un escenario con `@critico`

---

## Próximas pruebas pendientes (backlog)

Cuando el usuario pida agregar pruebas o implementar un módulo sin cobertura, prioriza en este orden:

1. **`StudentService.ts`** — Tests unitarios (sin cobertura actual)
2. **`e2e/features/estudiantes/`** — Feature E2E para `StudentsPage` y `StudentProfilePage`
3. **`MembershipService.ts`** — Tests unitarios
4. **`CommunicationService.ts`** — Tests unitarios (el E2E ya existe)
5. **`CourtesyService.ts`** — Tests unitarios (el E2E ya existe)
6. **`e2e/features/finanzas/`** — Feature E2E para `FinancePage`
7. **`e2e/features/pagos/`** — Feature E2E (los unit tests ya existen)
8. **`e2e/features/autenticacion/`** — Feature E2E para login/registro
9. **`e2e/features/dashboard/`** — Feature E2E para `DashboardPage`
