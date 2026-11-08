# Estándar de pruebas — GymOps

Fuente única de cómo se prueba cualquier funcionalidad. Aplica a personas y agentes.
**Una funcionalidad no está terminada hasta que tiene pruebas que intentan romperla.**

El camino feliz demuestra que algo funciona una vez. Las pruebas adversarias demuestran
que no se puede dañar. Por eso esta suite existe: con 39 escenarios en verde, la API aún
dejaba subir el stock con una venta de cantidad `-5` y no permitía crear un alumno sin teléfono.

## 1. Qué debe atacarse

Por cada dato de entrada, aplica lo que corresponda:

| Ataque | Ejemplos |
|---|---|
| Vacío y solo espacios | `""`, `"   "` |
| Tipo incorrecto | texto en un monto, número en un nombre |
| Límites | `0`, negativos, máximo + 1, decimales donde va un entero |
| Fechas | formato inválido, `2026-02-30`, pasado donde va futuro |
| Código inyectado | `<img src=x onerror=...>`, `' OR 1=1 --`, `(.*` |
| Duplicados | mismo documento, mismo ítem dos veces |
| Doble envío | doble clic en confirmar crea un solo registro |
| Referencias falsas | alumno, producto o id inexistente |
| Cancelación | cancelar una acción destructiva no cambia nada |
| Datos preexistentes | un campo opcional vacío **no** debe romper el guardado |

Además, en la API:

| Ataque | Qué comprobar |
|---|---|
| Sin token, token basura | 401 |
| Campos no permitidos | `status`, `PK`, `createdAt`, inventados: 400 |
| Precio, total o tipo manipulados | el servidor no confía en el cliente |
| Operación repetida | pagar dos veces la misma cuota: rechazada |
| Error real | un fallo interno es 500, no un 400 engañoso |

**La validación del frontend no es seguridad**: se puede saltar. Toda regla de negocio se
valida también en la Lambda.

## 2. Dónde va cada prueba

| Capa | Ubicación | Obligatorio |
|---|---|---|
| Gherkin E2E | `e2e/features/<modulo>/` | `@smoke`, `@critico` y `@adversarial` en cada módulo |
| Unitaria frontend | junto al servicio o `src/__tests__/` | Lógica y mapeos |
| Unitaria backend | `lambdas/<x>/*_test.go`, `internal/domain/<x>/` | Tabla `Test…RejectsAttacks` en toda Lambda que escriba |
| Caja negra | `gym-saas-infra/scripts/adversarial_api.py` | Cada endpoint de escritura nuevo |

## 3. Cómo escribir los Gherkin

1. **El título promete solo lo que los pasos verifican.** "Requiere confirmación" obliga a comprobarla.
2. **Cada parámetro se usa.** Si el paso dice `"Ana García"`, el dato sembrado se llama así. Prohibido `_nombre` ignorado en pasos nuevos.
3. **`Entonces` comprueba el estado guardado**, no solo un mensaje o que un formulario se abrió.
4. **Un ataque comprueba que nada cambió**: sin registro nuevo, stock igual, vencimiento igual.
5. **Sin fechas literales**: "vencimiento en 30 días". Una fecha fija se convierte en bug al pasar el tiempo.
6. **Lenguaje de negocio**: "registra un pago", no describir elementos de la pantalla (lo revisa `check-test-standard`).
7. **Muchos datos, un `Esquema del escenario`** con `Ejemplos`.
8. **Abrir una pantalla no es un escenario `@critico`.**

## 4. Tags

| Tag | Uso |
|---|---|
| `@e2e @<modulo>` | En la Característica |
| `@smoke` | La página carga y lo esencial se ve |
| `@critico` | Flujo principal del negocio |
| `@regresion` | Casos secundarios |
| `@adversarial` | Intentos de romper la funcionalidad |
| `@sin-sesion` | Corre con el login real activo y Cognito simulado (`e2e/helpers/cognito.ts`) |
| `@fixme` | Bug real conocido, con comentario encima que lo explique |

Un escenario adversario que falla por un bug real **nunca se borra ni se suaviza**: se
corrige el bug o se marca `@fixme` con su explicación, y se quita al corregirlo.

## 5. Definición de terminado

- [ ] Ataques de la sección 1 cubiertos en Gherkin y en la API.
- [ ] Vi cada prueba nueva **fallar** al quitar la validación que protege.
- [ ] `node scripts/check-test-standard.mjs` y `npm run bdd:test` en verde.
- [ ] `go test ./...` en verde y, tras desplegar a dev, `make adversarial`.

## 6. Seguridad de las propias pruebas

- Playwright levanta su servidor en el puerto **5174** y nunca reutiliza uno existente: un `vite --mode api` en 5173 haría que "reiniciar sistema" escribiera en dev.
- La caja negra se ejecuta **solo contra dev** y se niega a correr contra prod.

## 7. Cómo se hace cumplir

CI ejecuta `scripts/check-test-standard.mjs` y la suite E2E antes de desplegar. Una página
nueva sin feature, un módulo sin `@adversarial`, una fecha literal, un paso que ignora un
dato del escenario o lenguaje de interfaz **bloquean el PR**. En
infra, `internal/conventions` exige lo mismo para cada Lambda que escribe.
