## 1. Share Contract Gaps

- [x] 1.1 Audit the existing recipe-share repository, tRPC router, and shared-react hook surface against the requested web flows and add any missing support for reactivation, current-user inventories, and admin-wide inventories.
- [x] 1.2 Extend the web-facing share hooks and recipe detail context wiring so recipe pages, user settings, and admin settings can consume the finalized lifecycle and inventory APIs.

## 2. Recipe Page Share Management

- [x] 2.1 Add a share action to the recipe detail actions menu and open a recipe-scoped bottom panel built on the existing `Panel` pattern.
- [x] 2.2 Implement the panel content for per-recipe share creation, current-link listing, copy affordances, and revoke/reactivate/delete actions using the existing modal and toast patterns.
- [x] 2.3 Fix the desktop recipe hero/media radius regression while updating the recipe detail share entry points.

## 3. Settings Share Inventories

- [x] 3.1 Add a user settings share-link card with a table showing the current user's share links across recipes and lifecycle actions.
- [x] 3.2 Add an admin settings share-link card with an instance-wide table showing recipe, owner, status, and revoke/reactivate/delete controls.

## 4. Public Shared Recipe Page

- [x] 4.1 Extract the authenticated recipe detail page into reusable readonly presentation sections for media, summary, ingredients, notes, steps, and nutrition where applicable.
- [x] 4.2 Add a lightweight route boundary for `apps/web/app/share/[token]` outside `(app)` so the public page avoids the authenticated app shell and only mounts the providers it actually needs.
- [x] 4.3 Implement the `/share/[token]` web page using the shared recipe query plus the extracted readonly components for both desktop and mobile layouts.
- [x] 4.4 Remove authenticated-only controls from the shared page composition, respect `PublicRecipeViewDTO` field limits, and keep all new strings on existing or new `next-intl` namespaces.

## 5. Test Baseline And Stabilization

- [ ] 5.1 Capture the baseline of `pnpm --filter @norish/web run test:run` and record the current 14 pre-existing failures across the five known suites before feature verification.
- [ ] 5.2 Fix the existing failing subscription-related test suites in `__tests__/hooks/groceries/use-groceries-subscription.test.ts`, `__tests__/hooks/recipes/use-recipes-subscription.test.ts`, `__tests__/hooks/recipes/use-recipe-subscription.test.tsx`, and `__tests__/hooks/ratings/use-ratings-subscription.test.tsx`.
- [ ] 5.3 Fix the remaining failing `__tests__/hooks/stores/use-stores-mutations.test.ts` harness or contract mismatch so the baseline is no longer noisy.
- [ ] 5.4 Add or update web tests for the recipe share panel, settings share inventories, share-route layout isolation, shared page rendering, and the desktop media radius fix.

## 6. Verification

- [ ] 6.1 Run the targeted web test suite and any necessary typecheck or lint commands for the touched workspaces.
- [ ] 6.2 Manually verify recipe-page sharing, user settings management, admin moderation, revoked-link reactivation, invalid-link handling, and readonly shared-page behavior on desktop and mobile layouts.
