# Migration Inventory

Overview of every context and hook, where it lives today, and what happens to it.

## Contexts

### Already Shared

| Context                  | Web Source                                               | Mobile Source                                                  | Shared-React Location                             | Pattern                              |
| ------------------------ | -------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| `recipes-context`        | `web/context/recipes-context.tsx` (thin wrapper)         | `mobile/src/context/recipes-context.tsx` (thin wrapper)        | `src/contexts/recipes/recipes-context.tsx`        | `createRecipesContext` factory       |
| `recipe-filters-context` | `web/context/recipes-filters-context.tsx` (thin wrapper) | `mobile/src/context/recipe-filters-context.tsx` (thin wrapper) | `src/contexts/recipes/recipe-filters-context.tsx` | `createRecipeFiltersContext` factory |

### To Be Moved — Top-Level Contexts

| Context                  | Current Location                                                                     | Tier | Task Group | Action                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------ | ---- | ---------- | ------------------------------------------------------------------------- |
| `permissions-context`    | `web/context/permissions-context.tsx` + `mobile/src/context/permissions-context.tsx` | 1    | §1         | Create `createPermissionsContext` factory, both apps become thin wrappers |
| `household-context`      | `web/context/household-context.tsx`                                                  | 2    | §3         | Create `createHouseholdContext` factory, web becomes thin wrapper         |
| `user-context`           | `web/context/user-context.tsx`                                                       | 2    | §6         | Create `createUserContext` factory, web becomes thin wrapper              |
| `archive-import-context` | `web/context/archive-import-context.tsx`                                             | 4    | §10        | Create `createArchiveImportContext` factory, web becomes thin wrapper     |

### To Be Moved — Route-Level Contexts (`app/(app)/`)

| Context                      | Current Location                           | Tier | Task Group | Action                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------ | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calendar-context`           | `app/(app)/calendar/context.tsx`           | 4    | §9         | Create `createCalendarContext` factory (query, mutations, subscription via adapters)                                                                                            |
| `groceries-context`          | `app/(app)/groceries/context.tsx`          | 3    | §7         | Create `createGroceriesContext` factory (query, mutations, subscription via adapters; UI state remains in app wrapper or is injected via storage adapter for `useLocalStorage`) |
| `stores-context`             | `app/(app)/groceries/stores-context.tsx`   | 3    | §8         | Create `createStoresContext` factory (query, mutations, subscription via adapters)                                                                                              |
| `recipe-detail-context`      | `app/(app)/recipes/[id]/context.tsx`       | 5    | §11        | Create `createRecipeDetailContext` factory (query, subscription, nutrition, auto-tagging, allergy detection via adapters)                                                       |
| `admin-settings-context`     | `app/(app)/settings/admin/context.tsx`     | 5    | §13        | Create `createAdminSettingsContext` factory (query + mutations via adapters)                                                                                                    |
| `caldav-settings-context`    | `app/(app)/settings/caldav/context.tsx`    | 5    | §13        | Create `createCaldavSettingsContext` factory (queries, mutations, subscription via adapters; toast adapter for platform-specific toasts)                                        |
| `household-settings-context` | `app/(app)/settings/household/context.tsx` | 2    | §3         | Create `createHouseholdSettingsContext` factory (composes household context + mutations)                                                                                        |
| `user-settings-context`      | `app/(app)/settings/user/context.tsx`      | 2    | §6         | Create `createUserSettingsContext` factory (user query + mutations, toast/error adapter)                                                                                        |

### Staying Platform-Specific (Not Moving)

| Context                         | Location                                                  | Reason                                                      |
| ------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| `auth-context`                  | `mobile/src/context/auth-context.tsx`                     | Deeply tied to Expo auth client / mobile session management |
| `appearance-preference-context` | `mobile/src/context/appearance-preference-context.tsx`    | Uses `Uniwind` (native theming library)                     |
| `mobile-i18n-context`           | `mobile/src/context/mobile-i18n-context.tsx`              | Expo-specific locale loading, `react-intl` provider wiring  |
| `settings-sheet-context`        | `mobile/src/context/settings-sheet-context.tsx`           | Native bottom-sheet UI concern                              |
| `wake-lock-context`             | `app/(app)/recipes/[id]/components/wake-lock-context.tsx` | Browser WakeLock API                                        |

---

## Hooks

### Already Shared

| Hook Family                                      | Web Binding                                         | Mobile Binding                                             | Shared-React Location                  | Pattern                  |
| ------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- | ------------------------ |
| `permissions`                                    | `web/hooks/permissions/shared-permissions-hooks.ts` | `mobile/src/hooks/permissions/shared-permissions-hooks.ts` | `src/hooks/permissions/`               | `createPermissionsHooks` |
| `config` (partial — missing `use-version-query`) | `web/hooks/config/shared-config-hooks.ts`           | —                                                          | `src/hooks/config/`                    | `createConfigHooks`      |
| `recipes` — dashboard family                     | `web/hooks/recipes/shared-recipe-hooks.ts`          | `mobile/src/hooks/recipes/shared-recipe-hooks.ts`          | `src/hooks/recipes/dashboard/`         | `createRecipeHooks`      |
| `recipes` — recipe detail family                 | `web/hooks/recipes/shared-recipe-hooks.ts`          | `mobile/src/hooks/recipes/shared-recipe-hooks.ts`          | `src/hooks/recipes/recipe/`            | `createRecipeHooks`      |
| `use-user`                                       | —                                                   | —                                                          | `src/hooks/use-user.ts`                | Direct export            |
| `use-user-avatar`                                | —                                                   | —                                                          | `src/hooks/use-user-avatar.ts`         | Direct export            |
| `use-user-allergies-query`                       | —                                                   | —                                                          | `src/hooks/user/`                      | Factory                  |
| `use-unit-formatter`                             | —                                                   | —                                                          | `src/hooks/use-unit-formatter.ts`      | Direct export            |
| `use-dirty-state`                                | —                                                   | —                                                          | `src/hooks/use-dirty-state.ts`         | Direct export            |
| `use-grocery-form-state`                         | —                                                   | —                                                          | `src/hooks/use-grocery-form-state.ts`  | Direct export            |
| `use-connection-monitor`                         | —                                                   | —                                                          | `src/hooks/use-connection-monitor.tsx` | Direct export            |
| `use-scroll-restoration`                         | —                                                   | —                                                          | `src/hooks/use-scroll-restoration.ts`  | Direct export            |
| `use-servings-scaler`                            | —                                                   | —                                                          | `src/hooks/use-servings-scaler.ts`     | Direct export            |

**Note:** The entire recipe hooks family (dashboard + recipe detail) is already shared. Web files in `web/hooks/recipes/` are thin `"use client"` re-exports from `sharedDashboardRecipeHooks` / `sharedRecipeFamilyHooks`. This includes: `use-recipes-query`, `use-recipe-query`, `use-recipes-mutations`, `use-recipes-subscription`, `use-recipe-subscription`, `use-pending-recipes-query`, `use-recipe-id`, `use-recipe-autocomplete`, `use-recipe-ingredients`, `use-recipe-images`, `use-recipe-videos`, `use-recipes-cache`, `use-random-recipe`, `use-auto-tagging-query`, `use-auto-tagging-subscription`, `use-auto-categorization-subscription`, `use-allergy-detection-query`, `use-allergy-detection-subscription`, `use-nutrition-query`, `use-nutrition-mutation`, `use-nutrition-subscription`.

### To Be Moved — Hook Families (tRPC binding injection)

| Hook Family  | Current Location        | Hooks Included                                                                                         | Tier | Task Group |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------------ | ---- | ---------- |
| `households` | `web/hooks/households/` | `useHouseholdQuery`, `useHouseholdMutations`, `useHouseholdCache`, `useHouseholdSubscription`          | 2    | §2         |
| `favorites`  | `web/hooks/favorites/`  | `useFavoritesQuery`, `useFavoritesMutation`                                                            | 2    | §4         |
| `ratings`    | `web/hooks/ratings/`    | `useRatingsQuery`, `useRatingsMutation`, `useRatingsSubscription`                                      | 2    | §5         |
| `groceries`  | `web/hooks/groceries/`  | `useGroceriesQuery`, `useGroceriesMutations`, `useGroceriesCache`, `useGroceriesSubscription`          | 3    | §7         |
| `stores`     | `web/hooks/stores/`     | `useStoresQuery`, `useStoresMutations`, `useStoresCache`, `useStoresSubscription`                      | 3    | §8         |
| `calendar`   | `web/hooks/calendar/`   | `useCalendarQuery`, `useCalendarMutations`, `useCalendarCache`, `useCalendarSubscription`              | 4    | §9         |
| `archive`    | `web/hooks/archive/`    | `useArchiveImportQuery`, `useArchiveImportMutation`, `useArchiveCache`, `useArchiveImportSubscription` | 4    | §10        |
| `admin`      | `web/hooks/admin/`      | `useAdminQuery`, `useAdminMutations`                                                                   | 5    | §13        |
| `caldav`     | `web/hooks/caldav/`     | `useCaldavQuery`, `useCaldavMutations`, `useCaldavCache`, `useCaldavSubscription`                      | 5    | §13        |

### To Be Moved — Config Hook Extension

| Hook                | Current Location    | Tier | Task Group |
| ------------------- | ------------------- | ---- | ---------- |
| `use-version-query` | `web/hooks/config/` | 5    | §12        |

### To Be Moved — Standalone Hooks

| Hook                            | Current Location  | Tier | Task Group |
| ------------------------------- | ----------------- | ---- | ---------- |
| `use-amount-display-preference` | `web/hooks/`      | 5    | §12        |
| `use-recurrence-detection`      | `web/hooks/`      | 5    | §12        |
| `use-active-allergies`          | `web/hooks/user/` | 2    | §6         |

### Staying Platform-Specific (Not Moving)

| Hook                             | Location               | Reason                                                           |
| -------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| `use-clipboard-image-paste`      | `web/hooks/`           | Browser Clipboard API                                            |
| `use-container-columns`          | `web/hooks/`           | Browser ResizeObserver                                           |
| `use-in-view`                    | `web/hooks/`           | Browser IntersectionObserver                                     |
| `use-local-storage`              | `web/hooks/`           | Browser localStorage                                             |
| `use-wake-lock`                  | `web/hooks/`           | Browser WakeLock API                                             |
| `use-notification-permission`    | `web/hooks/`           | Browser Notification API                                         |
| `auto-hide`                      | `web/hooks/`           | Browser scroll behavior                                          |
| `use-grouped-grocery-dnd`        | `web/hooks/groceries/` | Browser drag-and-drop API                                        |
| `use-calendar-dnd`               | `web/hooks/calendar/`  | Browser drag-and-drop API                                        |
| `use-recipe-prefetch`            | `web/hooks/recipes/`   | Browser IntersectionObserver for viewport-based prefetching      |
| `use-recipe-filters`             | `web/hooks/recipes/`   | Convenience re-export of shared filters context (already shared) |
| `recipe-filters-storage-adapter` | `web/hooks/recipes/`   | Web localStorage adapter (mobile has its own)                    |
| `use-language-switch`            | `web/hooks/user/`      | Next.js cookie/router                                            |
| `use-locale-cookie`              | `web/hooks/user/`      | Next.js cookie                                                   |
| `use-locale`                     | `web/hooks/user/`      | Next.js navigation                                               |
| `use-user-cache`                 | `web/hooks/user/`      | Web-specific cache invalidation                                  |
| `use-user-mutations`             | `web/hooks/user/`      | Web-specific mutation with toast/locale                          |
| `use-user-query`                 | `web/hooks/user/`      | Web-specific query wrapper                                       |
