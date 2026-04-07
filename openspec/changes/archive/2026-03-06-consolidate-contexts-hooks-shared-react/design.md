## Context

The Norish monorepo has a `packages/shared-react` package that serves as the shared React logic layer for both web and mobile apps. Several contexts and hooks have already been successfully migrated there:

**Already shared:**

- **Contexts**: `recipes-context` (via `createRecipesContext` factory), `recipe-filters-context` (via `createRecipeFiltersContext` factory)
- **Hooks**: `permissions` (via `createPermissionsHooks`), `config` (via `createConfigHooks`), `recipes` (via `createRecipeHooks` — dashboard + recipe families), `user` (via `useUser`), plus standalone hooks (`use-dirty-state`, `use-grocery-form-state`, `use-connection-monitor`, `use-scroll-restoration`, `use-servings-scaler`, `use-unit-formatter`, `use-user-avatar`)

**Still duplicated or web-only:**

- **Contexts**: `permissions-context` (near-identical in web + mobile), `household-context` (web), `user-context` (web), `archive-import-context` (web)
- **Hook families**: `households`, `favorites`, `ratings`, `groceries`, `stores`, `calendar`, `caldav`, `admin`, `archive` (all web-only with tRPC bindings)
- **Remaining recipe hooks**: auto-tagging, nutrition, allergy detection, images, videos, prefetch, autocomplete, random recipe
- **Standalone hooks**: `use-amount-display-preference`, `use-recurrence-detection`

The established pattern uses a **factory function** that accepts platform-specific adapters (e.g., `useTRPC`, toast adapters, navigation adapters) and returns context providers + hooks. This cleanly separates shared business logic from platform-specific runtime dependencies.

## Goals / Non-Goals

**Goals:**

- Unify all shareable React contexts and hooks into `packages/shared-react` using the established factory/adapter pattern
- Eliminate the near-duplicate permissions context implementations in web and mobile
- Enable mobile to adopt more hook families as mobile features grow (households, groceries, etc.)
- Maintain the thin-wrapper pattern: each app wires platform adapters and re-exports

**Non-Goals:**

- Moving platform-specific hooks that depend on browser APIs (`use-clipboard-image-paste`, `use-container-columns`, `use-in-view`, `use-local-storage`, `use-wake-lock`, `use-auto-hide`)
- Moving mobile-only contexts that are deeply tied to native APIs (`auth-context` with Expo auth, `appearance-preference-context` with Uniwind, `mobile-i18n-context` with Expo locale, `settings-sheet-context` with native sheet)
- Refactoring the tRPC router layer or API contracts
- Creating shared UI components (stays in `packages/ui`)
- Moving hooks for features that don't yet exist on mobile (caldav, admin) — but making them available in shared-react prepares for future use

## Decisions

### 1. Factory pattern for contexts – `create*Context({ ...adapters })`

**Decision**: Use the same factory approach proven by `createRecipesContext` and `createRecipeFiltersContext`.

**Rationale**: This pattern is already working well. Each factory accepts hooks/adapters as parameters, creates the React context internally, and returns `{ Provider, useContext }`. Apps call the factory with their platform-specific implementations.

**Alternatives considered**:

- _Direct context with conditional imports_ — Rejected because it would couple shared-react to platform packages
- _Abstract class / inheritance_ — Over-engineered for React hook composition

### 2. Factory pattern for hooks – `create*Hooks({ useTRPC })`

**Decision**: Continue the `create*Hooks` pattern used by `createPermissionsHooks`, `createConfigHooks`, and `createRecipeHooks`.

**Rationale**: The `useTRPC` injection avoids shared-react depending on any specific tRPC client setup. Each app binds once in a `shared-*-hooks.ts` file.

### 3. Permissions context gets a dedicated factory with user-ID adapter

**Decision**: Create `createPermissionsContext({ useCurrentUserId, usePermissionsQuery })` that accepts a hook returning the current user ID and a permissions query hook.

**Rationale**: The only difference between web and mobile permissions contexts is how they get the user ID — web uses `useUserContext().user?.id`, mobile uses `useAuth().user?.id`. The business logic (normalizing permissions, `canView/Edit/Delete` selectors) is identical. The shared permissions hooks (`usePermissionsQuery`) already exist in shared-react, so the factory just needs the user-ID source.

### 4. Household context factory with subscription adapter

**Decision**: Create `createHouseholdContext({ useHouseholdQuery, useHouseholdSubscription })` following the same adapter pattern as the recipes context.

**Rationale**: The recipes context already proves that subscriptions with platform-specific dependencies (toasts, navigation) work cleanly through adapter injection. The household context follows the same approach — each app injects its own subscription hook implementation.

### 5. User context factory with sign-out and session adapters

**Decision**: Create `createUserContext({ useSessionUser, useSignOut, useFreshUserQuery? })` with adapters for session and sign-out.

**Rationale**: Web uses `betterAuthSignOut()` + `window.location.href` redirect; mobile uses `authClient.signOut()`. The context shape (user, isLoading, signOut) can be shared, but the auth mechanics are platform-specific. The web-specific `userMenuOpen` state stays in the web wrapper.

### 6. Hook families follow consistent module structure

**Decision**: Each hook family in `shared-react/src/hooks/<domain>/` follows:

```
<domain>/
  index.ts           — factory export + type re-exports
  types.ts           — shared types
  use-<name>.ts      — individual hook factory functions
```

**Rationale**: Consistent structure makes it easy to add new domains and matches the existing `permissions/`, `config/`, `recipes/` structure.

### 7. Batch migration in priority tiers

**Decision**: Prioritize based on immediate code deduplication value:

1. **Tier 1** — Permissions context (active duplication in web+mobile)
2. **Tier 2** — Household, favorites, ratings hooks + household/user contexts (used heavily, straightforward)
3. **Tier 3** — Groceries, stores hooks (larger, more complex)
4. **Tier 4** — Calendar, caldav, admin, archive hooks + archive context (web-only for now)
5. **Tier 5** — Remaining recipe hooks, standalone hooks, config version hook

**Rationale**: Tier 1 addresses the explicit user request for unified permissions. Tiers 2-3 cover the most commonly used features. Tiers 4-5 are less urgent since they're web-only.

## Risks / Trade-offs

- **Large surface area** → Mitigated by following the proven factory pattern exactly; each hook family is a self-contained unit
- **Import path churn** → Mitigated by keeping app-local barrel files (`shared-*-hooks.ts`) that re-export; consumers in app code import from their local barrel, not directly from shared-react
- **Shared-react bundle size increase** → Acceptable trade-off; tree-shaking ensures unused factories aren't bundled. Each factory is only instantiated if the app calls it
- **Testing complexity** → Mitigated by shared-react having its own test suite (already has `__tests__/` directory with hook and export tests)
- **Mobile not using all hook families immediately** → Not a risk, just unused exports. The factories are zero-cost until instantiated
