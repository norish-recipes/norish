## Context

`apps/mobile` home currently renders recipe cards from a deterministic in-app mock dataset, while web uses backend-backed recipe hooks under `apps/web/hooks/recipes`. This creates duplicate data logic and inconsistent behavior between clients (especially for loading, error, and live user data states). The repository already has `packages/shared-react` and mobile tRPC/base URL infrastructure, so the key design challenge is extracting reusable recipe domain hooks without coupling shared code to web-only framework concerns.

## Goals / Non-Goals

**Goals:**
- Move recipe querying/domain hook logic from `apps/web/hooks/recipes` into a reusable shared package consumed by web and mobile.
- Wire mobile home recipe list to backend-backed data via shared hooks.
- Preserve strong typing for recipe query inputs/outputs through existing tRPC boundary contracts.
- Define explicit UI-state behavior for mobile home: loading, empty, error, and data-present.

**Non-Goals:**
- Redesigning recipe card UI layout/content beyond data-state handling.
- Changing backend recipe procedures, response contracts, or adding new API endpoints.
- Refactoring unrelated web/mobile feature hooks outside recipe-home scope.

## Decisions

### Fixture mode policy
- **Decision:** Remove mock data from normal runtime paths for recipes list/dashboard sections, with one temporary exception: Today meal slots remain fixture-backed until planned-meals shared hooks are implemented.
- **Rationale:** We need immediate live-data behavior for core recipe dashboard surfaces, while Today requires a new backend hook pattern (`query + subscription`) that is being split into follow-up work.
- **Alternatives considered:**
  - Remove all mock paths including Today immediately: ideal end state, but blocks near-term delivery while meal-plan hook contracts are defined.

### Extract recipe domain hooks into `packages/shared-react`
- **Decision:** Move reusable recipe query hooks and normalization/helpers from `apps/web/hooks/recipes` into `packages/shared-react/recipes` (or equivalent existing shared-react module structure).
- **Rationale:** Keeps data-domain logic in one place and avoids web/mobile divergence.
- **Alternatives considered:**
  - Keep duplicate hook implementations in each app: faster short-term but high long-term drift/maintenance cost.
  - Put shared logic in backend package: would couple client hook ergonomics to server package boundaries and React-query concerns.

### Keep app-specific transport/provider adapters local
- **Decision:** Shared hooks accept typed caller/client dependencies from each app's existing provider setup; web and mobile keep their own transport wiring and runtime provider composition.
- **Rationale:** Shared logic stays portable while respecting platform-specific runtime setup (Next/web route context vs Expo/mobile URL bootstrap).
- **Alternatives considered:**
  - Centralize provider wiring in shared-react: risks forcing one runtime composition pattern across incompatible app shells.

### Replace mock-home source with backend-first query states on mobile
- **Decision:** Mobile home uses shared recipe query hooks as the source of truth and renders dedicated loading/empty/error/success states.
- **Rationale:** Aligns behavior with web and delivers real user data.
- **Alternatives considered:**
  - Keep mock fallback when backend unavailable: hides connectivity/auth issues and can mask real-data bugs in production flows.

### Preserve compatibility via phased extraction
- **Decision:** First migrate web hook imports to shared-react with no behavior change, then switch mobile home consumption.
- **Rationale:** De-risks by validating extraction in the existing web path before introducing mobile integration changes.
- **Alternatives considered:**
  - Switch mobile first from copied code: increases risk of unresolved parity issues and duplicated bug fixes.

### Web-coupled utilities use adapters before extraction
- **Decision:** Keep UI/session/routing/storage concerns behind adapters (`storage`, `ui notifications`, `navigation`, `media upload payload`) so shared hooks remain platform agnostic.
- **Rationale:** Most hooks are portable 1:1 with React Query; adapter boundaries isolate web-only assumptions.
- **Alternatives considered:**
  - Keep all coupled hooks web-only: avoids adapter work now, but blocks mobile dashboard parity and duplicates logic long term.

### Defer Today meal-plan hook extraction to follow-up
- **Decision:** Create a dedicated follow-up task/change for `planned recipes of today` shared hooks (query + subscription), while this change keeps Today on temporary mock data.
- **Rationale:** Keeps current scope focused on moving existing recipe hooks and shipping live backend data for collection/discovery flows first.
- **Alternatives considered:**
  - Expand current scope to include meal-plan hooks now: increases integration risk and delays removal of broader recipe mocks.

## Hook Migration Map

### Move now (shared 1:1)
- `apps/web/hooks/recipes/use-recipe-id.ts`
- `apps/web/hooks/recipes/use-recipes-query.ts`
- `apps/web/hooks/recipes/use-recipes-cache.ts`
- `apps/web/hooks/recipes/use-recipe-query.ts`
- `apps/web/hooks/recipes/use-pending-recipes-query.ts`
- `apps/web/hooks/recipes/use-auto-tagging-query.ts`
- `apps/web/hooks/recipes/use-allergy-detection-query.ts`
- `apps/web/hooks/recipes/use-auto-tagging-subscription.ts`
- `apps/web/hooks/recipes/use-auto-categorization-subscription.ts`
- `apps/web/hooks/recipes/use-allergy-detection-subscription.ts`
- `apps/web/hooks/recipes/use-nutrition-query.ts`
- `apps/web/hooks/recipes/use-nutrition-mutation.ts`
- `apps/web/hooks/recipes/use-nutrition-subscription.ts`
- `apps/web/hooks/recipes/use-recipe-autocomplete.ts`
- `apps/web/hooks/recipes/use-recipe-ingredients.ts`
- `apps/web/hooks/recipes/use-random-recipe.ts`

### Move with adapter
- `apps/web/hooks/recipes/use-recipe-filters.ts` (localStorage -> mobile storage adapter)
- `apps/web/hooks/recipes/use-recipes-mutations.ts` (toast/i18n/file payload abstractions)
- `apps/web/hooks/recipes/use-recipes-subscription.tsx` (navigation/toast callbacks)
- `apps/web/hooks/recipes/use-recipe-subscription.tsx` (router/session callbacks)
- `apps/web/hooks/recipes/use-recipe-images.ts` (File/FormData -> RN media adapter)
- `apps/web/hooks/recipes/use-recipe-videos.ts` (File/FormData -> RN media adapter)

### Keep web-only
- `apps/web/hooks/recipes/use-recipe-prefetch.ts` (IntersectionObserver/DOM prefetch behavior)

### New shared hooks in follow-up change
- `use-todays-planned-recipes-query` (name tentative)
- `use-todays-planned-recipes-subscription` (name tentative)

## Risks / Trade-offs

- [Shared module accidentally imports web-only utilities] -> Mitigation: enforce platform-agnostic imports in shared-react and keep app adapters thin.
- [Type drift between shared hooks and app tRPC callers] -> Mitigation: source all router types from existing boundary package and add compile checks in both apps.
- [Mobile UX regressions during loading/error transitions] -> Mitigation: codify each state in spec scenarios and verify on device/emulator with realistic backend responses.
- [Extraction introduces web regressions] -> Mitigation: migrate web imports first and run existing web recipe-home checks before mobile wiring.

## Migration Plan

1. Identify reusable pieces inside `apps/web/hooks/recipes` and move them to `packages/shared-react` with stable exports.
2. Update web imports to consume shared-react recipe hooks and verify unchanged behavior.
3. Add/adjust mobile adapter glue so shared hooks can use mobile's existing tRPC and query setup.
4. Replace mobile mock dataset usage in home recipes surface and non-Today dashboard sections with shared backend-backed hooks.
5. Keep Today section fixture isolated behind one data adapter so it can be swapped to shared planned-meals hooks in follow-up.
6. Validate loading/empty/error/success states and remove obsolete mock-only home data path outside Today.

Rollback: revert app import migration and restore prior mobile wiring if critical production blocker appears.

## Open Questions

- None for this change; Today backend source selection is deferred to the follow-up planned-meals hook task.
