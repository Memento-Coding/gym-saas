---
inclusion: fileMatch
fileMatchPattern: '**/components/**/*Form*.tsx'
name: Estándares de Formularios
description: Reglas obligatorias de validación, UX e integridad de datos para todos los formularios de GymOps.
---

# STEERING_FORMS — Estándares de Formularios (GymOps)

Documento oficial de estándares para el diseño, validación e implementación de
formularios en GymOps. Es de cumplimiento **obligatorio** para cualquier PR que
cree o modifique un formulario.

Stack de referencia: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui,
`react-hook-form` v7, `zod` v4 (`@hookform/resolvers`). Persistencia mediante la
capa abstraída `StorageService` (IndexedDB/localStorage → DynamoDB en el futuro).

> **Fuente única de validación.** Toda validación de negocio debe apoyarse en el
> catálogo reutilizable `src/utils/validation.ts`. Prohibido duplicar reglas
> "a mano" dentro de cada formulario.

---

## 0. Modelo de responsabilidades (Front / Back / DB)

Toda regla queda documentada indicando dónde vive su enforcement. GymOps es hoy
"backend-less" (StorageService en cliente), por lo que la capa **Back** se
simula en los `*Service.ts`, y **DB** es el contrato futuro con DynamoDB.

| Capa | Responsable hoy | Responsable futuro | Qué valida |
| --- | --- | --- | --- |
| **Front** | Componente + `zod` (`src/utils/validation.ts`) | igual | Tipos, formato, rangos, obligatoriedad, feedback inmediato, UX. Nunca es la única defensa. |
| **Back (simulado)** | `*Service.ts` (`StudentService`, `PaymentService`) | Lambda / API | Reglas de negocio, unicidad, cálculos autoritativos (fechas, montos), coherencia referencial. Revalida SIEMPRE lo que llega del front. |
| **DB** | `StorageService` (clave/valor) | DynamoDB (PK/índices) | Restricciones de unicidad e integridad como última barrera (índice único sobre `documentId`, condition expressions). |

Regla de oro: **el front nunca es la autoridad**. Todo dato validado en el
front se **revalida en el service** antes de persistir (validación dual).

---

## 1. Inputs numéricos

Aplica a `monthlyFee`, `price`, `amount`, `discount`, `classesPerMonth`,
porcentajes y días de congelamiento.

**Reglas obligatorias:**

1. **Prohibido texto/caracteres especiales.** Solo dígitos (y separador decimal
   cuando el campo lo permita). No confiar en `type="number"` del navegador: se
   valida el valor parseado con Zod (`z.coerce.number()` + refinamientos).
2. **`min`/`max` explícitos.** Todo input numérico declara límites. Sin límite
   superior "natural", se define un máximo defensivo del dominio.
3. **Bloqueo de negativos.** Montos (`monthlyFee`, `amount`, `price`,
   `discount`) usan `nonNegativeAmount` → nunca `< 0`.
4. **Enteros donde corresponda.** Cantidades como `classesPerMonth` o días usan
   `positiveInteger`; rechazan decimales.
5. **Porcentajes** acotados a `[0, 100]` vía `percentage`.
6. **Validación dual.** El front usa el schema del catálogo; el service
   (`Back`) revalida el mismo invariante antes de escribir en `StorageService`.

**UI:** `inputMode="decimal"` o `"numeric"`, `step`, `min` y `max` en el
`<Input>` de shadcn, más el schema Zod como autoridad real.

```tsx
<Input type="number" inputMode="decimal" min={0} step="0.01" {...field} />
```

---

## 2. Selects

Aplica a selección de plan (`planId` / `planName`), método de pago, categoría.

**Reglas obligatorias:**

1. **Datos dinámicos autorizados.** Las opciones se cargan desde la fuente real
   (ej. `CostsConfig.memberships` vía `StorageService`), nunca hardcodeadas por
   copia.
2. **Sin entrada manual.** Se usa `<Select>` de shadcn (no un `<input>` libre).
   El usuario no puede inyectar valores fuera del catálogo.
3. **Invalidación de valores inexistentes.** El valor elegido se valida contra
   el array de origen con `selectFromSource`. Un valor que no está en el
   catálogo actual (ej. plan eliminado) es inválido y bloquea el submit.
4. **Placeholder no seleccionable** ("Selecciona un plan…") que no pasa como
   valor válido si el campo es obligatorio.
5. **Validación dual.** El service revalida que el `planId` exista en la
   configuración vigente antes de persistir.

---

## 3. Campos obligatorios

**Criterios de obligatoriedad:**

- Un campo es obligatorio si el dominio no puede existir sin él (`documentId`,
  `firstName`, `planId`, `amount`) o por regla condicional (ej. `guardianName` /
  `guardianDocument` cuando `isMinor === true`).
- La obligatoriedad se declara en el schema Zod y se refleja visualmente con
  `*` en el `<FormLabel>` (`<span className="text-destructive">*</span>`).

**Mensajes de error estandarizados:**

- Formato único: `` `${label} es obligatorio.` `` (ver
  `requiredMessage(label)`).
- Rango numérico: `` `${label} debe estar entre ${min} y ${max}.` ``
- Negativos: `` `${label} no puede ser negativo.` ``
- Los mensajes se muestran con `<FormMessage />` de shadcn/ui, nunca con
  `alert()`.

**Bloqueo de submit:**

- El botón de envío se deshabilita durante `isLoading` y el envío se aborta si
  el schema no valida. La resolución de validación ocurre en `onSubmit` como
  mínimo (`mode: 'onSubmit'`), pudiendo elevarse a `onBlur`/`onChange`.

---

## 4. Fechas

Aplica a `registrationDate`, `subscriptionEndDate` (vencimiento), `date` de pago,
`freezeDate` / `freezeEndDate`.

**Reglas obligatorias:**

1. **Formato canónico ISO `YYYY-MM-DD`** y cálculo en **UTC** para evitar
   desfases de zona horaria. Utilidades centralizadas en `validation.ts`
   (`parseIsoDateUTC`, `toIsoDateUTC`, `addOneMonthUTC`).
2. **Cálculo automático del vencimiento.** La fecha de vencimiento **no se
   digita a mano**: se deriva de la fecha de pago + configuración del plan.
   - `paid` + plan **no** `single` → `max(vencimientoPrevio, fechaPago) + 1 mes`
     (con clamping de día: 31 ene → 28/29 feb).
   - `upgrade` / `credit` o plan `single` → no extiende el vencimiento.
   - Lógica autoritativa: `computeSubscriptionEndDate` (catálogo) reutilizada por
     `PaymentService` (Back).
3. **Integridad cronológica.** Rango de fechas válido: la fecha "fin" nunca puede
   ser anterior a la fecha "inicio" (`chronological`). Fechas de nacimiento no
   pueden ser futuras.
4. **Consistencia de zona horaria.** Prohibido mezclar `Date` local y UTC. Se
   unifica en los helpers UTC del catálogo (reconcilia la divergencia previa
   entre `PaymentService` UTC y `StudentService` local).

---

## 5. Integridad de datos

**Unicidad (ej. `documentId`):**

1. **Front:** al perder foco / antes del submit se consulta unicidad simulando
   backend con `isDocumentUnique(document, storage)`, que lee la colección desde
   `StorageService` y compara (excluyendo el propio `id` en modo edición).
2. **Back (simulado):** el service revalida la unicidad antes de escribir
   (patrón ya presente en `StudentService.register`). Nunca se confía solo en el
   front.
3. **DB (futuro):** DynamoDB con índice único / condition expression sobre
   `documentId` como barrera final.

**Antes de persistir**, todo formulario ejecuta:
`validación de schema (front)` → `revalidación + unicidad (service)` →
`escritura (StorageService)`. Si cualquier etapa falla, no se persiste y se
retorna un `ServiceResult` de error.

---

## 6. UX/UI: Modales vs. Páginas y estandarización visual

**Cuándo usar Modal (Dialog de shadcn):**

- Acción corta y enfocada, ≤ ~6 campos, sin navegación anidada.
- Ejemplos: registrar un pago, congelar membresía, editar un plan.
- No debe contener flujos de varios pasos ni tablas complejas.

**Cuándo usar Página (ruta dedicada):**

- Formularios largos o de varias secciones (alta/edición completa de estudiante).
- Flujos multi-paso, o que necesitan deep-link / recarga sin perder contexto.
- Cuando conviven con listas, tabs o subformularios.

**Estandarización visual (obligatoria):**

- Usar SIEMPRE los componentes de `src/components/ui` (shadcn): `Form`,
  `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`, `Input`,
  `Select`, `Checkbox`, `Button`, `Dialog`.
- Errores exclusivamente vía `<FormMessage />`. Toasts (`sonner`) solo para
  resultado de la operación (éxito/fallo de guardado), no para validación de
  campos.
- Campo obligatorio marcado con `*` en el label.
- Botón primario a la derecha; "Cancelar" (`variant="outline"`) a su izquierda.
- Acciones deshabilitadas mientras `isLoading`.

---

## 7. Plan de migración (formularios existentes → estándar)

Estado actual: tres patrones conviven —`StudentForm` (RHF + Zod dinámico),
`PaymentForm` (RHF + validación manual inline), `PlanEditor` (`useState` sin
schema). Objetivo: converger todos a RHF + `zodResolver` alimentado por
`src/utils/validation.ts`.

**Paso 1 — Fundaciones (este PR).**
Crear el catálogo `src/utils/validation.ts` y su cobertura de tests. No cambia
comportamiento de UI todavía; establece la fuente única de reglas.

**Paso 2 — `PaymentForm`.**
Sustituir las `rules` inline por un `zodResolver` con schema de pago del
catálogo (`nonNegativeAmount` para monto/descuento, `selectFromSource` para plan
y método, `computeSubscriptionEndDate` para el vencimiento). Mantener los
cálculos ya correctos de `PaymentService`.

**Paso 3 — `PlanEditor`.**
Migrar de `useState` a RHF + Zod. `price` con `nonNegativeAmount`,
`classesPerMonth` con `positiveInteger`, `name` obligatorio y único dentro de la
categoría. Reemplazar validación implícita por schema.

**Paso 4 — `StudentForm`.**
Conservar el schema dinámico existente pero delegar los invariantes numéricos y
de select al catálogo, y añadir la validación de unicidad de `documentId` en el
front (`isDocumentUnique`) además de la ya existente en el service.

**Paso 5 — Endurecer los services (Back).**
Asegurar que cada `*Service` revalide con las mismas utilidades antes de
`storage.set(...)`. Reconciliar el manejo de fechas a UTC (helpers del catálogo).

**Paso 6 — Contrato DB (futuro).**
Documentar los índices únicos y condition expressions que DynamoDB deberá
imponer (empezando por `documentId`), de modo que la simulación actual sea un
espejo del comportamiento futuro.

**Criterio de "hecho" por formulario migrado:**
sin inputs numéricos sin restricción · selects contra datos reales · unicidad
front + service · fechas calculadas, nunca digitadas · errores vía
`<FormMessage />` · cobertura de tests unitarios + integración.

---

## 8. Checklist obligatoria de PR (QA)

- [ ] No existen campos sin validación ni inputs numéricos sin restricciones.
- [ ] Todos los selects consumen datos reales (fuente dinámica autorizada).
- [ ] Hay pruebas unitarias y de integración para las reglas/flujos tocados.
- [ ] No se eliminaron validaciones existentes sin justificación escrita.
- [ ] Unicidad validada en front y en simulación backend (service).
- [ ] Se cumplen los estándares UX (Modal vs Página, shadcn, mensajes).
- [ ] Las fechas de vencimiento se calculan automáticamente (no se digitan).
- [ ] Responsabilidades Front / Back / DB documentadas para cada regla nueva.
