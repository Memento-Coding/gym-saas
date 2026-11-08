# Trabajo con varios agentes

Varias sesiones de Claude pueden trabajar a la vez en este repo. Sigue estas reglas para no pisar el trabajo de otra.

## Aislamiento

- Cada sesión trabaja en su propio worktree y su propia rama, creada desde `origin/develop`.
- No trabajes en el checkout principal `gym-saas`: queda para que el dueño del repo revise.
- Antes de hacer `git switch`, `stash`, `reset` o `checkout`, mira `git status`. Si hay cambios que no son tuyos, no los toques.

## Áreas

Cada zona del código tiene una sola sesión dueña. Al empezar, usa `ListAgents` y pregunta a las sesiones activas qué área tienen.

| Área | Alcance |
|---|---|
| Formularios y datos | Formularios, validación, tipos, recursos y mappers de API |
| Tests | `e2e/`, tests unitarios, estado de la suite |
| UI | Tokens, layout, `src/components/ui/`, páginas públicas |

## Archivos compartidos

Solo los edita su dueño. Si necesitas un cambio, pídeselo por `SendMessage`.

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
