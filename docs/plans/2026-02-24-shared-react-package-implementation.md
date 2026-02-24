# Shared React Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `@norish/shared-react`, move all React-specific shared code into it, and migrate Broad Wave A modules while preserving existing web behavior.

**Architecture:** Introduce a dedicated React package under `packages/shared-react` and move provider/hook/context ownership there. Keep `@norish/shared` focused on runtime-agnostic contracts and utilities. Update web imports in one coordinated pass and delete old React paths as modules move.

**Tech Stack:** TypeScript, React 19, TanStack Query, tRPC, Vitest, PNPM workspaces, OpenSpec.

---

### Task 1: Scaffold `@norish/shared-react` Package

**Files:**
- Create: `packages/shared-react/package.json`
- Create: `packages/shared-react/tsconfig.json`
- Create: `packages/shared-react/src/index.ts`
- Create: `packages/shared-react/src/hooks/index.ts`
- Create: `packages/shared-react/src/contexts/index.ts`
- Create: `packages/shared-react/src/providers/index.ts`
- Create: `packages/shared-react/vitest.config.ts`

**Step 1: Write the failing test**

Create `packages/shared-react/__tests__/exports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as sharedReact from "@norish/shared-react";

describe("shared-react exports", () => {
  it("exports package surface", () => {
    expect(sharedReact).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @norish/shared-react test`
Expected: FAIL (package missing or exports unresolved)

**Step 3: Write minimal implementation**

Create package scaffold and minimal barrel exports listed above.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @norish/shared-react test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared-react
git commit -m "feat: scaffold shared-react workspace package"
```

### Task 2: Move Provider Layer to `@norish/shared-react`

**Files:**
- Move: `packages/shared/src/react/providers/trpc-provider.tsx` -> `packages/shared-react/src/providers/trpc-provider.tsx`
- Modify: `packages/shared-react/src/providers/index.ts`
- Modify: `apps/web/app/providers/trpc-provider.tsx`
- Delete: `packages/shared/src/react/providers/index.ts`

**Step 1: Write the failing test**

Create `packages/shared-react/__tests__/providers-exports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTRPCProviderBundle } from "@norish/shared-react/providers";

describe("providers exports", () => {
  it("exports trpc provider factory", () => {
    expect(typeof createTRPCProviderBundle).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @norish/shared-react test -- providers-exports`
Expected: FAIL (export missing)

**Step 3: Write minimal implementation**

Move provider file and update imports in `apps/web/app/providers/trpc-provider.tsx` to `@norish/shared-react/providers`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @norish/shared-react test -- providers-exports`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared-react/src/providers apps/web/app/providers/trpc-provider.tsx
git commit -m "refactor: move trpc provider ownership to shared-react"
```

### Task 3: Move Existing React Hooks/Contexts from `@norish/shared`

**Files:**
- Move: `packages/shared/src/react/hooks/*` -> `packages/shared-react/src/hooks/*`
- Move: `packages/shared/src/react/contexts/*` -> `packages/shared-react/src/contexts/*`
- Modify: `packages/shared-react/src/hooks/index.ts`
- Modify: `packages/shared-react/src/contexts/index.ts`
- Modify: `packages/shared-react/src/index.ts`
- Modify: all web imports currently using `@norish/shared/react/hooks` or `@norish/shared/react/contexts`
- Delete: `packages/shared/src/react/hooks/*`, `packages/shared/src/react/contexts/*`

**Step 1: Write the failing test**

Create `packages/shared-react/__tests__/hooks-exports.test.ts` with assertions for moved hook exports (e.g. `useUnitFormatter`, `useServingsScaler`).

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @norish/shared-react test -- hooks-exports`
Expected: FAIL (hooks not exported yet)

**Step 3: Write minimal implementation**

Move hooks/contexts and update all call sites to `@norish/shared-react/hooks` and `@norish/shared-react/contexts`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @norish/shared-react test -- hooks-exports`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared-react/src apps/web
git commit -m "refactor: move shared react hooks and contexts to shared-react"
```

### Task 4: Move Stores Subscription Shared Handler

**Files:**
- Move: `packages/shared/src/react/hooks/use-stores-subscription.ts` -> `packages/shared-react/src/hooks/use-stores-subscription.ts`
- Modify: `apps/web/hooks/stores/use-stores-subscription.ts`
- Modify: `packages/shared-react/src/hooks/index.ts`
- Delete: old file from `packages/shared/src/react/hooks/`

**Step 1: Write the failing test**

Create `packages/shared-react/__tests__/stores-subscription-handlers.test.ts` with create/update/delete/reorder coverage.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @norish/shared-react test -- stores-subscription-handlers`
Expected: FAIL (handler export missing)

**Step 3: Write minimal implementation**

Move handler module and update web subscription hook import to `@norish/shared-react/hooks`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @norish/shared-react test -- stores-subscription-handlers`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared-react/src/hooks apps/web/hooks/stores/use-stores-subscription.ts
git commit -m "refactor: move stores subscription handler to shared-react"
```

### Task 5: Broad Wave A Context Migration

**Files:**
- Move: `apps/web/context/household-context.tsx` -> `packages/shared-react/src/contexts/household-context.tsx`
- Move: `apps/web/context/permissions-context.tsx` -> `packages/shared-react/src/contexts/permissions-context.tsx`
- Move: `apps/web/context/recipes-filters-context.tsx` -> `packages/shared-react/src/contexts/recipes-filters-context.tsx`
- Modify: web imports consuming those contexts
- Delete: old `apps/web/context/*` files above

**Step 1: Write the failing tests**

Add/adjust tests for each context provider/hook in web or shared-react tests to assert providers render and values are available.

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @norish/web test:run -- context`
Expected: FAIL (imports unresolved)

**Step 3: Write minimal implementation**

Move context modules and replace `@/` dependencies with shared-safe imports or injected props.

**Step 4: Run tests to verify pass**

Run: `pnpm --filter @norish/web test:run -- context`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared-react/src/contexts apps/web
git commit -m "refactor: migrate wave-a contexts into shared-react"
```

### Task 6: Broad Wave A Hook Migration

**Files:**
- Move: `apps/web/hooks/recipes/use-recipe-ingredients.ts` -> `packages/shared-react/src/hooks/recipes/use-recipe-ingredients.ts`
- Move: `apps/web/hooks/use-recurrence-detection.ts` -> `packages/shared-react/src/hooks/use-recurrence-detection.ts`
- Move: `apps/web/hooks/user/use-active-allergies.ts` -> `packages/shared-react/src/hooks/user/use-active-allergies.ts`
- Modify: all web consumers of these hooks
- Delete: old files from `apps/web/hooks/**`

**Step 1: Write the failing tests**

Add/adjust hook tests to assert behavior and exports from `@norish/shared-react/hooks`.

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @norish/shared-react test`
Expected: FAIL (hook paths/exports not ready)

**Step 3: Write minimal implementation**

Move modules, update imports, and inject any app-specific dependencies at web boundary if required.

**Step 4: Run tests to verify pass**

Run: `pnpm --filter @norish/shared-react test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared-react/src/hooks apps/web
git commit -m "refactor: migrate wave-a hooks into shared-react"
```

### Task 7: Remove React Surface from `@norish/shared`

**Files:**
- Modify: `packages/shared/package.json` (remove `./react*` exports)
- Modify: `packages/shared/src/index.ts` (remove React barrel export)
- Delete: `packages/shared/src/react/**`
- Modify: any remaining imports referencing `@norish/shared/react*`

**Step 1: Write the failing check**

Run: `pnpm --filter @norish/web typecheck`
Expected: FAIL until all references are moved to `@norish/shared-react/*`

**Step 2: Write minimal implementation**

Remove old exports/files and update remaining imports.

**Step 3: Run checks to verify pass**

Run:
- `pnpm --filter @norish/shared-react typecheck`
- `pnpm --filter @norish/shared-react test`
- `pnpm --filter @norish/web typecheck`
- `pnpm --filter @norish/web test:run`

Expected: PASS

**Step 4: Validate OpenSpec**

Run: `openspec validate refactor-share-hooks-contexts --strict --no-interactive`
Expected: valid

**Step 5: Commit**

```bash
git add packages/shared packages/shared-react apps/web openspec/changes/refactor-share-hooks-contexts/tasks.md pnpm-lock.yaml
git commit -m "refactor: complete shared-react migration for wave-a modules"
```
