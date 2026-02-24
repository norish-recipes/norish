## 1. Discovery and classification

- [x] 1.1 Inventory all `apps/web/context/**` and `apps/web/hooks/**` modules and classify each as `runtime-safe`, `adapter-required`, or `web-only`.
- [x] 1.2 Record non-shareable modules with blocking dependency reason (for example Next.js router, browser-only APIs, HeroUI-only composition) and migration trigger.

## 2. Shared package extraction

- [x] 2.1 Create/expand shared React exports for extracted hooks/contexts in a package under `packages/*`.
- [ ] 2.2 Move `runtime-safe` modules into shared package paths and update imports in `apps/web`.
- [ ] 2.3 Move `adapter-required` modules by extracting platform-specific effects behind injected adapters/interfaces.
- [ ] 2.4 Keep `web-only` modules in `apps/web` and replace direct cross-module imports with shared interfaces where needed.

## 3. Boundary enforcement

- [ ] 3.1 Add dependency guardrails so shared hooks/contexts cannot import `next/*`, DOM globals, or web-only UI wrappers directly.
- [ ] 3.2 Add lint or dependency-check validation that fails CI when shared runtime boundaries are violated.

## 4. Validation

- [ ] 4.1 Run typecheck, lint, and tests for affected workspaces.
- [ ] 4.2 Verify `apps/web` behavior is unchanged for extracted modules.
- [ ] 4.3 Validate React Native readiness by confirming shared exports compile without web-only imports.

## 5. Documentation

- [ ] 5.1 Publish a maintained shareability matrix (module, classification, reason, owner, next action).
- [ ] 5.2 Document adapter patterns and do/don't rules for adding new shared hooks/contexts.
