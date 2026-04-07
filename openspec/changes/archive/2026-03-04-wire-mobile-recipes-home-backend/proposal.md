## Why

The mobile recipe-home work is underway, but the shared recipe hook extraction is still too mixed: dashboard hooks and recipe hooks are not clearly separated, so it is unclear which hooks should be used in each screen. We should refine this change to mirror the proven shared config-hook pattern and make hook intent explicit before implementation starts.

## What Changes

- Keep the backend wiring scope, but refine hook architecture to match how shared config hooks were created (shared core + app-owned bindings + thin app wrappers).
- Split shared recipe hooks into two explicit families: dashboard hooks (home sections and collection surfaces) and recipe hooks (single-recipe query, mutation, and subscription flows).
- Define naming/export boundaries so dashboard screens cannot accidentally consume singular hooks (and vice versa) without obvious intent.
- Continue wiring mobile home dashboard sections (Continue Cooking, Discover, Your Collection) to backend-backed shared dashboard hooks.
- Keep Today meal slots on temporary fixture data in this change and preserve the follow-up plan for planned-meals shared hooks (`query + subscription`).
- Define mobile loading, empty, error, and success states against backend-backed dashboard hooks.

## Capabilities

### New Capabilities

- `shared-recipe-hooks`: Shared React recipe hooks with clear dashboard-vs-singular boundaries and app-owned tRPC binding support for web and mobile.

### Modified Capabilities

- `mobile-home-recipe-cards`: Home recipe list requirements shift from mock-only bootstrap behavior to backend-backed dashboard-hook behavior and explicit loading/error/empty states.
- `home-dashboard`: Dashboard sections shift from mixed fixture/subset wiring to backend-backed dashboard hooks, except Today meal slots which remain temporary fixture data pending follow-up meal-plan hook extraction.

## Impact

- Affected code: `apps/mobile` home/dashboard wiring, `apps/web/hooks/recipes` wrapper/extraction points, and `packages/shared-react` recipe hook module structure/exports.
- Affected APIs: existing recipe backend procedures only; no new backend endpoint required.
- Dependencies/systems: TanStack Query with typed tRPC bindings in both apps, following the same app-owned binding pattern used by shared config hooks.
- Behavioral impact: clearer hook ownership and usage intent (dashboard vs recipe) reduces ambiguous imports and migration mistakes.
