# Shared React Package Design

## Context

Norish is migrating hooks and contexts for cross-platform reuse. React-specific modules are currently split between `apps/web` and `@norish/shared`, with web-local provider imports creating portability friction.

## Decisions

- Create a new package: `@norish/shared-react`.
- Move all React-specific code out of `@norish/shared` into `@norish/shared-react`.
- Use big-bang migration strategy (single coordinated pass).
- Delete old paths as modules are moved (no long-lived compatibility mirrors).
- Include Broad Wave A modules in the same migration pass.

## Package Boundaries

- `@norish/shared-react`: React providers, hooks, contexts, React Query/tRPC integration glue.
- `@norish/shared`: non-React shared assets only (contracts, cross-runtime utilities, libs).
- `apps/web`: platform bootstrap and unavoidable Next/web runtime boundaries only.

## Broad Wave A Scope

- `apps/web/context/household-context.tsx`
- `apps/web/context/permissions-context.tsx`
- `apps/web/context/recipes-filters-context.tsx`
- `apps/web/hooks/recipes/use-recipe-ingredients.ts`
- `apps/web/hooks/use-recurrence-detection.ts`
- `apps/web/hooks/user/use-active-allergies.ts`

## Migration Rules

- Move all `packages/shared/src/react/**` into `packages/shared-react/src/**`.
- Update app imports from `@norish/shared/react/*` to `@norish/shared-react/*`.
- Remove `@norish/shared` React export surfaces after consumer updates.
- For app-local imports (`@/`), convert to shared-safe imports or injected dependencies.
- Preserve behavior while changing ownership and import boundaries.

## Verification Gate

- `pnpm --filter @norish/shared-react typecheck`
- `pnpm --filter @norish/shared-react test`
- `pnpm --filter @norish/web typecheck`
- `pnpm --filter @norish/web test:run` (or targeted suites if needed)
- `openspec validate refactor-share-hooks-contexts --strict --no-interactive`
