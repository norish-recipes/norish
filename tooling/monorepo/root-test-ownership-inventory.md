# Root Test Ownership Inventory

Change: `update-monorepo-root-hardening-completion` (task 3)

## Baseline (before migration wave)

- Source location: root `__tests__/`
- Total files discovered: 169
- Ownership destinations:
  - `@norish/web`: `apps/web/__tests__/` (164 files)
  - `@norish/api`: `packages/api/__tests__/` (5 files)

## Mapping by legacy root scope

| Legacy root scope | File count | Destination workspace | Destination path |
| --- | ---: | --- | --- |
| `__tests__/hooks/**` | 35 | `@norish/web` | `apps/web/__tests__/hooks/**` |
| `__tests__/mocks/**` | 27 | `@norish/web` | `apps/web/__tests__/mocks/**` |
| `__tests__/trpc/**` | 25 | `@norish/web` | `apps/web/__tests__/trpc/**` |
| `__tests__/server/**` (excluding `server/ai/**`) | 18 | `@norish/web` | `apps/web/__tests__/server/**` |
| `__tests__/app/**` | 11 | `@norish/web` | `apps/web/__tests__/app/**` |
| `__tests__/components/**` | 8 | `@norish/web` | `apps/web/__tests__/components/**` |
| `__tests__/importers/**` | 6 | `@norish/web` | `apps/web/__tests__/importers/**` |
| `__tests__/queue/**` | 6 | `@norish/web` | `apps/web/__tests__/queue/**` |
| `__tests__/lib/**` | 5 | `@norish/web` | `apps/web/__tests__/lib/**` |
| `__tests__/ai/**` | 4 | `@norish/api` | `packages/api/__tests__/ai/**` |
| `__tests__/server/ai/**` | 1 | `@norish/api` | `packages/api/__tests__/ai/**` |
| `__tests__/helpers/**` | 4 | `@norish/web` | `apps/web/__tests__/helpers/**` |
| `__tests__/auth/**` | 3 | `@norish/web` | `apps/web/__tests__/auth/**` |
| `__tests__/config/**` | 2 | `@norish/web` | `apps/web/__tests__/config/**` |
| `__tests__/integration/**` | 2 | `@norish/web` | `apps/web/__tests__/integration/**` |
| `__tests__/setup/**` | 2 | `@norish/web` | `apps/web/__tests__/setup/**` |
| `__tests__/startup/**` | 2 | `@norish/web` | `apps/web/__tests__/startup/**` |
| `__tests__/apps/**` | 1 | `@norish/web` | `apps/web/__tests__/apps/**` |
| `__tests__/context/**` | 1 | `@norish/web` | `apps/web/__tests__/context/**` |
| `__tests__/db/**` | 1 | `@norish/web` | `apps/web/__tests__/db/**` |
| `__tests__/scripts/**` | 1 | `@norish/web` | `apps/web/__tests__/scripts/**` |
| `__tests__/helpers.test.ts` | 1 | `@norish/web` | `apps/web/__tests__/helpers.test.ts` |
| `__tests__/permissions.test.ts` | 1 | `@norish/web` | `apps/web/__tests__/permissions.test.ts` |
| `__tests__/recurrence-calculator.test.ts` | 1 | `@norish/web` | `apps/web/__tests__/recurrence-calculator.test.ts` |
| `__tests__/recurrence-parser.test.ts` | 1 | `@norish/web` | `apps/web/__tests__/recurrence-parser.test.ts` |

## Migration wave execution

- Wave 1 moved root `__tests__/` into workspace-owned test roots.
- AI-focused tests were moved into `packages/api/__tests__/ai/**` to match API package ownership.
- Legacy root `__tests__/` no longer exists after the wave.
