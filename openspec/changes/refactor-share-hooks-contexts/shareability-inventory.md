# Hook/Context Shareability Inventory (Refined Task 1)

## Scope

- Scanned module roots: `apps/web/context/**`, `apps/web/hooks/**`
- Classifications:
  - `runtime-safe`: no obvious web/runtime framework coupling
  - `adapter-required`: coupled to tRPC/React Query data layer; can move with adapter boundary
  - `web-only`: directly coupled to Next.js navigation, browser globals, or web-only UI composition
- This refinement includes direct and transitive coupling checks (for example: barrel exports and context-level dependencies on web-only hooks).

## Summary

- Total modules scanned: 108
- `runtime-safe`: 27
- `adapter-required`: 58
- `web-only`: 23

## Runtime-Safe Candidates (move first)

- `apps/web/context/household-context.tsx`
- `apps/web/context/permissions-context.tsx`
- `apps/web/context/recipes-filters-context.tsx`
- `apps/web/hooks/admin/index.ts`
- `apps/web/hooks/archive/index.ts`
- `apps/web/hooks/caldav/index.ts`
- `apps/web/hooks/calendar/index.ts`
- `apps/web/hooks/calendar/use-calendar-dnd.ts`
- `apps/web/hooks/config/index.ts`
- `apps/web/hooks/favorites/index.ts`
- `apps/web/hooks/groceries/index.ts`
- `apps/web/hooks/groceries/use-grouped-grocery-dnd.ts`
- `apps/web/hooks/households/index.ts`
- `apps/web/hooks/permissions/index.ts`
- `apps/web/hooks/ratings/index.ts`
- `apps/web/hooks/recipes/index.ts`
- `apps/web/hooks/recipes/use-recipe-ingredients.ts`
- `apps/web/hooks/recipes/use-servings-scaler.ts`
- `apps/web/hooks/stores/index.ts`
- `apps/web/hooks/use-connection-monitor.tsx`
- `apps/web/hooks/use-dirty-state.ts`
- `apps/web/hooks/use-grocery-form-state.ts`
- `apps/web/hooks/use-recurrence-detection.ts`
- `apps/web/hooks/use-scroll-restoration.ts`
- `apps/web/hooks/use-user-avatar.ts`
- `apps/web/hooks/use-user.ts`
- `apps/web/hooks/user/use-active-allergies.ts`

## Adapter-Required Candidates (extract after adapter seams)

- `apps/web/hooks/admin/use-admin-mutations.ts`
- `apps/web/hooks/admin/use-admin-query.ts`
- `apps/web/hooks/archive/use-archive-cache.ts`
- `apps/web/hooks/archive/use-archive-import-query.ts`
- `apps/web/hooks/caldav/use-caldav-cache.ts`
- `apps/web/hooks/caldav/use-caldav-mutations.ts`
- `apps/web/hooks/caldav/use-caldav-query.ts`
- `apps/web/hooks/calendar/use-calendar-cache.ts`
- `apps/web/hooks/calendar/use-calendar-mutations.ts`
- `apps/web/hooks/calendar/use-calendar-query.ts`
- `apps/web/hooks/calendar/use-calendar-subscription.ts`
- `apps/web/hooks/config/use-locale-config-query.ts`
- `apps/web/hooks/config/use-recurrence-config-query.ts`
- `apps/web/hooks/config/use-tags-query.ts`
- `apps/web/hooks/config/use-timer-keywords-query.ts`
- `apps/web/hooks/config/use-timers-enabled-query.ts`
- `apps/web/hooks/config/use-units-query.ts`
- `apps/web/hooks/config/use-upload-limits-query.ts`
- `apps/web/hooks/config/use-version-query.ts`
- `apps/web/hooks/favorites/use-favorites-mutation.ts`
- `apps/web/hooks/favorites/use-favorites-query.ts`
- `apps/web/hooks/groceries/use-groceries-cache.ts`
- `apps/web/hooks/groceries/use-groceries-mutations.ts`
- `apps/web/hooks/groceries/use-groceries-query.ts`
- `apps/web/hooks/groceries/use-groceries-subscription.ts`
- `apps/web/hooks/households/use-household-cache.ts`
- `apps/web/hooks/households/use-household-mutations.ts`
- `apps/web/hooks/households/use-household-query.ts`
- `apps/web/hooks/permissions/use-permissions-query.ts`
- `apps/web/hooks/ratings/use-ratings-mutation.ts`
- `apps/web/hooks/ratings/use-ratings-query.ts`
- `apps/web/hooks/ratings/use-ratings-subscription.ts`
- `apps/web/hooks/recipes/use-allergy-detection-query.ts`
- `apps/web/hooks/recipes/use-allergy-detection-subscription.ts`
- `apps/web/hooks/recipes/use-auto-categorization-subscription.ts`
- `apps/web/hooks/recipes/use-auto-tagging-query.ts`
- `apps/web/hooks/recipes/use-auto-tagging-subscription.ts`
- `apps/web/hooks/recipes/use-nutrition-mutation.ts`
- `apps/web/hooks/recipes/use-nutrition-query.ts`
- `apps/web/hooks/recipes/use-nutrition-subscription.ts`
- `apps/web/hooks/recipes/use-pending-recipes-query.ts`
- `apps/web/hooks/recipes/use-random-recipe.ts`
- `apps/web/hooks/recipes/use-recipe-autocomplete.ts`
- `apps/web/hooks/recipes/use-recipe-id.ts`
- `apps/web/hooks/recipes/use-recipe-images.ts`
- `apps/web/hooks/recipes/use-recipe-query.ts`
- `apps/web/hooks/recipes/use-recipe-videos.ts`
- `apps/web/hooks/recipes/use-recipes-cache.ts`
- `apps/web/hooks/recipes/use-recipes-mutations.ts`
- `apps/web/hooks/recipes/use-recipes-query.ts`
- `apps/web/hooks/stores/use-stores-cache.ts`
- `apps/web/hooks/stores/use-stores-mutations.ts`
- `apps/web/hooks/stores/use-stores-query.ts`
- `apps/web/hooks/stores/use-stores-subscription.ts`
- `apps/web/hooks/use-unit-formatter.ts`
- `apps/web/hooks/user/use-user-cache.ts`
- `apps/web/hooks/user/use-user-mutations.ts`
- `apps/web/hooks/user/use-user-query.ts`

## Web-Only (cannot move yet)

- `apps/web/context/archive-import-context.tsx` - depends on `useArchiveImportSubscription` web toast/UI side-effects.
- `apps/web/context/recipes-context.tsx` - uses `next/navigation` and web toast composition.
- `apps/web/context/user-context.tsx` - uses `window.location` redirect.
- `apps/web/hooks/archive/use-archive-import-mutation.ts` - includes web toast/UI integration.
- `apps/web/hooks/archive/use-archive-import-subscription.ts` - includes web toast/UI integration.
- `apps/web/hooks/auto-hide.tsx` - depends on `usePathname`, window/document scrolling.
- `apps/web/hooks/caldav/use-caldav-subscription.ts` - web UI side-effects.
- `apps/web/hooks/households/use-household-subscription.ts` - web UI side-effects.
- `apps/web/hooks/recipes/use-recipe-filters.ts` - direct `localStorage` persistence.
- `apps/web/hooks/recipes/use-recipe-prefetch.ts` - browser scheduling/access patterns.
- `apps/web/hooks/recipes/use-recipe-subscription.tsx` - uses Next router/link.
- `apps/web/hooks/recipes/use-recipes-subscription.tsx` - uses Next link + web toasts.
- `apps/web/hooks/use-amount-display-preference.ts` - localStorage/browser state.
- `apps/web/hooks/use-clipboard-image-paste.ts` - `window` paste listeners.
- `apps/web/hooks/use-container-columns.ts` - DOM measurements.
- `apps/web/hooks/use-in-view.tsx` - browser `IntersectionObserver`.
- `apps/web/hooks/use-local-storage.ts` - direct localStorage API.
- `apps/web/hooks/use-notification-permission.ts` - browser `Notification` API.
- `apps/web/hooks/use-wake-lock.tsx` - browser wake lock + document visibility APIs.
- `apps/web/hooks/user/index.ts` - exports web-only locale hooks from one surface.
- `apps/web/hooks/user/use-language-switch.tsx` - depends on web locale hook (`use-locale`) and web icon composition.
- `apps/web/hooks/user/use-locale-cookie.ts` - `next/navigation` + `document.cookie`.
- `apps/web/hooks/user/use-locale.ts` - `next/navigation`.

## Migration Triggers for Web-Only Items

- Navigation-coupled modules: move once navigation adapter interface is defined (`push`, `replace`, `pathname`).
- Storage/cookie modules: move once storage adapter (`getItem`, `setItem`, `removeItem`) and cookie adapter are provided.
- Browser capability modules (wake lock, notifications, clipboard): move once capability adapters with no-op/native implementations exist.
- UI-toast linked modules: move once feedback events are emitted from shared hooks and rendered in platform layer.
- Contexts coupled to web-only hooks: move once those hooks are split into runtime-safe core + platform adapter wrappers.

## Non-Shareable Blockers (with trigger)

### Adapter-Required (blocked until adapter seam exists)

- Data-layer hooks (`use-*-query`, `use-*-mutation`, `use-*-subscription`, `use-*-cache`) are blocked by direct `@tanstack/react-query` and/or `@trpc/tanstack-react-query` usage.
  - Migration trigger: shared query adapter contract exists (query client, invalidation, subscription bridge) with web/native implementations.
- `apps/web/hooks/use-unit-formatter.ts` is blocked by direct `next-intl` locale access and web query hook dependencies.
  - Migration trigger: locale + units adapter provides `locale`, `units`, and formatter input without `next-intl` dependency.

### Web-Only (blocked in current form)

- Next router/navigation coupling (`useRouter`, `usePathname`, `next/link`).
  - Migration trigger: navigation adapter with `push`, `replace`, `pathname`, and link abstraction.
- Browser storage/cookie coupling (`localStorage`, `document.cookie`).
  - Migration trigger: storage/cookie adapter interfaces implemented per platform.
- Browser API coupling (`window`, `document`, `IntersectionObserver`, `Notification`, wake lock).
  - Migration trigger: capability adapters with no-op/native-safe fallbacks.
- Web UI composition coupling (`@heroui/react`, web toast composition, icon components returned from hooks).
  - Migration trigger: hooks emit neutral events/state and platform UI consumes those events.

## Recommended First Extraction Wave

- Start with `runtime-safe` contexts and utility hooks that have no router/browser coupling.
- In parallel, define adapter contracts for data-layer hooks to unlock `adapter-required` migration.
- Keep `web-only` files in place for now and track each against a concrete adapter milestone.
