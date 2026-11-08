# Trabajo con varios agentes

Por defecto trabaja una sola sesión. Usa varias a la vez solo si sus áreas no se tocan, y máximo tres.

## Dónde trabajar

Todo vive en `~/gym-saas`. Infra es un repo aparte en `~/gym-saas/gym-saas-infra`. No crees copias en carpetas hermanas ni en `/tmp`.

Al empezar, usa `ListAgents`:

- **Sin otra sesión activa:** trabaja en `~/gym-saas`, en una rama nueva desde `origin/develop`.
- **Con otra sesión activa:** crea un worktree en `.claude/worktrees/<tema>` con `claude -w <tema>` o `EnterWorktree`. Parte de `master`, así que corre `git rebase origin/develop` antes de empezar.

En un worktree, enlaza `node_modules` de `~/gym-saas` si `package-lock.json` es igual. Si es distinto, corre `npm ci`: un enlace haría que tu cambio de dependencias altere las de las demás sesiones.

En infra trabaja una sola sesión a la vez, siempre en su carpeta.

Antes de hacer `git switch`, `stash`, `reset` o `checkout`, mira `git status`. Si hay cambios que no son tuyos, no los toques.

## Al terminar

Cuando la rama esté subida, detén tus servidores y borra tu worktree con `ExitWorktree` o `git worktree remove`, sin `--force`. Si git se niega, hay trabajo sin guardar: revísalo antes de seguir.

## Servidores y puertos

- Cada sesión levanta su propio servidor, en un puerto libre y con `--strictPort`.
- El puerto `5173` es del dueño del repo: es el único que Google acepta en local.
- Los E2E usan `5174` y `5175` sin reutilizar servidores, así que solo cabe una corrida a la vez. Si están ocupados, espera.
- No detengas un servidor que no iniciaste.

## Áreas

Cada zona del código tiene una sola sesión dueña. Si hay otras sesiones activas, pregúntales qué área tienen.

| Área | Alcance |
|---|---|
| Formularios y datos | Formularios, validación, tipos, recursos y mappers de API |
| Tests | `e2e/`, tests unitarios, estado de la suite |
| UI | Tokens, layout, `src/components/ui/`, páginas públicas |

## Archivos compartidos

Mientras haya varias sesiones activas, solo los edita su dueño. Si necesitas un cambio, pídeselo por `SendMessage`.

| Archivo | Dueño |
|---|---|
| `src/index.css` | UI |
| `src/App.tsx` | UI |
| `src/types/` | Formularios y datos |
| `src/utils/validation.ts` | Formularios y datos |

Si el dueño no está activo, pregunta al dueño del repo antes de editar.

## Integración

- PRs pequeños contra `develop`. Solo el dueño del repo fusiona.
- Después de cada fusión, actualiza tu rama desde `develop` antes de seguir.
- Avisa por `SendMessage` antes de cambiar un tipo o un contrato de API que otra área use.
- Si un test falla, compáralo con `develop` antes de atribuirlo a tu cambio.

## Tests

- Corre los tests unitarios con Node 22 (`.nvmrc`). Node 26 rompe el `localStorage` de jsdom y hace fallar decenas de tests.
- El estándar de pruebas está en `docs/STEERING_TESTING.md`.
