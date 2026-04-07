## Why

Web and mobile still maintain duplicate context and hook implementations that follow identical patterns but live in app-specific directories. The recipes context and filter context have already been successfully moved to `shared-react` using a factory/adapter pattern, proving the approach works. The remaining contexts (permissions, household, user, archive-import) and numerous hook families (households, favorites, ratings, groceries, stores, calendar, caldav, admin, archive, plus standalone hooks) still exist as web-only or duplicated code. The permissions context in particular has near-identical implementations in both web and mobile that should be unified into a single shared contract.

## What Changes

- **Unify permissions context** into `shared-react` using the same `create*Context` factory pattern, replacing the near-identical web and mobile implementations with a single shared contract
- **Move household context + household-settings context** to `shared-react` with adapter injection for the subscription hook
- **Move user context + user-settings context** to `shared-react` with adapter injection for sign-out behavior (web uses `window.location`, mobile uses auth client)
- **Move archive-import context** to `shared-react` (web-only for now, but ready for mobile adoption)
- **Move route-level contexts** from `app/(app)/` to `shared-react`: calendar context, groceries context, stores context, recipe-detail context, admin-settings context, caldav-settings context — all using the factory/adapter pattern
- **Move remaining web hook families** (households, favorites, ratings, groceries, stores, calendar, caldav, admin, archive) to `shared-react` using the existing `create*Hooks` factory pattern with `useTRPC` injection
- **Move standalone web hooks** (`use-amount-display-preference`, `use-recurrence-detection`, `use-unit-formatter`, `use-notification-permission`) where they are platform-agnostic or can be abstracted
- **Keep platform-specific hooks in their apps**: `use-clipboard-image-paste` (web clipboard API), `use-container-columns` (web resize observer), `use-in-view` (web IntersectionObserver), `use-local-storage` (web localStorage), `use-wake-lock` (web WakeLock API), `use-auto-hide` (web scroll behavior), mobile-only contexts (`auth-context`, `appearance-preference-context`, `mobile-i18n-context`, `settings-sheet-context`)
- **Thin app wrappers remain** in each app to wire platform-specific adapters (toast, navigation, auth provider) into shared factories

## Capabilities

### New Capabilities

- `shared-permissions-context`: Shared permissions context factory with user-ID adapter injection, replacing duplicated web/mobile implementations
- `shared-household-context`: Shared household context factory with subscription adapter
- `shared-user-context`: Shared user context factory with sign-out and session adapters
- `shared-archive-context`: Shared archive-import context factory
- `shared-household-hooks`: Shared household hook family (query, mutations, cache, subscription) with tRPC injection
- `shared-favorites-hooks`: Shared favorites hook family (query, mutation) with tRPC injection
- `shared-ratings-hooks`: Shared ratings hook family (query, mutation, subscription) with tRPC injection
- `shared-groceries-hooks`: Shared groceries hook family (query, mutations, cache, subscription) with tRPC injection
- `shared-stores-hooks`: Shared stores hook family (query, mutations, cache, subscription) with tRPC injection
- `shared-calendar-hooks`: Shared calendar hook family (query, mutations, cache, subscription) with tRPC injection
- `shared-archive-hooks`: Shared archive hook family (import query, import mutation, cache, subscription) with tRPC injection
- `shared-standalone-hooks`: Platform-agnostic standalone hooks (amount display preference, recurrence detection)

### Modified Capabilities

- `shared-recipe-hooks`: Add remaining recipe hooks not yet moved (auto-tagging, nutrition, allergy detection, recipe images/videos, prefetch, autocomplete, random recipe)
- `shared-config-hooks`: Add version query hook not yet moved

## Impact

- **`apps/web/context/`**: All 6 files will become thin wrappers calling shared factories (3 already are)
- **`apps/mobile/src/context/`**: `permissions-context.tsx` and `recipes-context.tsx` become thin wrappers (recipes already is); `auth-context`, `appearance-preference-context`, `mobile-i18n-context`, `settings-sheet-context` stay mobile-only
- **`apps/web/hooks/`**: All hook subdirectories converted to bind shared factories via `create*Hooks({ useTRPC })`; 5-6 platform-specific standalone hooks remain web-only
- **`packages/shared-react/`**: Significant growth in `src/hooks/` and `src/contexts/` with new factory modules
- **Imports throughout web app**: Many `@/hooks/*` imports will shift to use shared hook instances
- **No API or contract changes**: All tRPC router contracts remain identical; this is purely a code organization change
