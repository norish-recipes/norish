## 1. Shared Permissions Context (Tier 1 — Active Duplication)

- [x] 1.1 Create `packages/shared-react/src/contexts/permissions/` module with `createPermissionsContext` factory that accepts `useCurrentUserId` and `usePermissionsQuery` adapters, exports `PermissionsContextValue` type
- [x] 1.2 Refactor `apps/web/context/permissions-context.tsx` to a thin wrapper calling `createPermissionsContext` with web's `useUserContext().user?.id` adapter
- [x] 1.3 Refactor `apps/mobile/src/context/permissions-context.tsx` to a thin wrapper calling `createPermissionsContext` with mobile's `useAuth().user?.id` adapter
- [x] 1.4 Update `packages/shared-react/src/contexts/index.ts` to export permissions context
- [x] 1.5 Verify web and mobile both build and existing permission checks work unchanged

## 2. Shared Household Hooks

- [x] 2.1 Create `packages/shared-react/src/hooks/households/` module with `createHouseholdHooks` factory (types, `useHouseholdQuery`, `useHouseholdMutations`, `useHouseholdCache`, `useHouseholdSubscription`)
- [x] 2.2 Create `apps/web/hooks/households/shared-household-hooks.ts` binding file: `export const sharedHouseholdHooks = createHouseholdHooks({ useTRPC })`
- [x] 2.3 Update web household hook barrel (`apps/web/hooks/households/index.ts`) to re-export from shared hooks
- [x] 2.4 Update `packages/shared-react/src/hooks/index.ts` to export households
- [x] 2.5 Verify web builds and household functionality works unchanged

## 3. Shared Household Contexts

- [x] 3.1 Create `packages/shared-react/src/contexts/households/` module with `createHouseholdContext` factory that accepts `useHouseholdQuery` and `useHouseholdSubscription` adapters
- [x] 3.2 Refactor `apps/web/context/household-context.tsx` to a thin wrapper calling `createHouseholdContext` with web's shared household hooks
- [x] 3.3 Create `createHouseholdSettingsContext` factory in same module that accepts `useHouseholdContext` and `useHouseholdMutations` adapters
- [x] 3.4 Refactor `apps/web/app/(app)/settings/household/context.tsx` to a thin wrapper calling `createHouseholdSettingsContext`
- [x] 3.5 Update `packages/shared-react/src/contexts/index.ts` to export household contexts
- [x] 3.6 Verify web builds and household context consumers work unchanged

## 4. Shared Favorites Hooks

- [x] 4.1 Create `packages/shared-react/src/hooks/favorites/` module with `createFavoritesHooks` factory (`useFavoritesQuery`, `useFavoritesMutation`)
- [x] 4.2 Create `apps/web/hooks/favorites/shared-favorites-hooks.ts` binding file
- [x] 4.3 Update web favorites hook barrel to re-export from shared hooks
- [x] 4.4 Update `packages/shared-react/src/hooks/index.ts` to export favorites
- [x] 4.5 Verify web builds and favorites functionality works unchanged

## 5. Shared Ratings Hooks

- [x] 5.1 Create `packages/shared-react/src/hooks/ratings/` module with `createRatingsHooks` factory (`useRatingsQuery`, `useRatingsMutation`, `useRatingsSubscription`)
- [x] 5.2 Create `apps/web/hooks/ratings/shared-ratings-hooks.ts` binding file
- [x] 5.3 Update web ratings hook barrel to re-export from shared hooks
- [x] 5.4 Update `packages/shared-react/src/hooks/index.ts` to export ratings
- [x] 5.5 Verify web builds and ratings functionality works unchanged

## 6. Shared User Contexts

- [x] 6.1 Create `packages/shared-react/src/contexts/user/` module with `createUserContext` factory that accepts `useSessionUser`, `useSignOut`, and optional `useFreshUserQuery` adapters
- [x] 6.2 Refactor `apps/web/context/user-context.tsx` to a thin wrapper calling `createUserContext` with web adapters (web keeps `userMenuOpen` in its wrapper)
- [x] 6.3 Create `createUserSettingsContext` factory in same module that accepts `useUserSettingsQuery`, `useUserMutations`, and toast/error adapters
- [x] 6.4 Refactor `apps/web/app/(app)/settings/user/context.tsx` to a thin wrapper calling `createUserSettingsContext`
- [x] 6.5 Move `use-active-allergies` to `packages/shared-react/src/hooks/user/` (pure logic: picks household vs user allergies, builds Set — no platform deps once household context is shared)
- [x] 6.6 Update `packages/shared-react/src/contexts/index.ts` to export user contexts
- [x] 6.7 Verify web builds and user context consumers work unchanged

## 7. Shared Groceries Hooks & Context

- [x] 7.1 Create `packages/shared-react/src/hooks/groceries/` module with `createGroceriesHooks` factory (`useGroceriesQuery`, `useGroceriesMutations`, `useGroceriesCache`, `useGroceriesSubscription`)
- [x] 7.2 Create `apps/web/hooks/groceries/shared-groceries-hooks.ts` binding file
- [x] 7.3 Update web groceries hook barrel to re-export from shared hooks (keep `useGroupedGroceryDnd` web-only)
- [x] 7.4 Create `packages/shared-react/src/contexts/groceries/` module with `createGroceriesContext` factory that accepts query, mutations, subscription adapters and a storage adapter for view-mode persistence
- [x] 7.5 Refactor `apps/web/app/(app)/groceries/context.tsx` to a thin wrapper calling `createGroceriesContext` (web injects `useLocalStorage` for view-mode; UI state like panels can stay in wrapper or be part of factory)
- [x] 7.6 Update `packages/shared-react/src/hooks/index.ts` and `src/contexts/index.ts` to export groceries
- [x] 7.7 Verify web builds and groceries functionality works unchanged

## 8. Shared Stores Hooks & Context

- [x] 8.1 Create `packages/shared-react/src/hooks/stores/` module with `createStoresHooks` factory (`useStoresQuery`, `useStoresMutations`, `useStoresCache`, `useStoresSubscription`)
- [x] 8.2 Create `apps/web/hooks/stores/shared-stores-hooks.ts` binding file
- [x] 8.3 Update web stores hook barrel to re-export from shared hooks
- [x] 8.4 Create `packages/shared-react/src/contexts/stores/` module with `createStoresContext` factory that accepts query, mutations, subscription adapters
- [x] 8.5 Refactor `apps/web/app/(app)/groceries/stores-context.tsx` to a thin wrapper calling `createStoresContext`
- [x] 8.6 Update `packages/shared-react/src/hooks/index.ts` and `src/contexts/index.ts` to export stores
- [x] 8.7 Verify web builds and stores functionality works unchanged

## 9. Shared Calendar Hooks & Context

- [x] 9.1 Create `packages/shared-react/src/hooks/calendar/` module with `createCalendarHooks` factory (`useCalendarQuery`, `useCalendarMutations`, `useCalendarCache`, `useCalendarSubscription`)
- [x] 9.2 Create `apps/web/hooks/calendar/shared-calendar-hooks.ts` binding file
- [x] 9.3 Update web calendar hook barrel to re-export from shared hooks (keep `useCalendarDnd` web-only)
- [x] 9.4 Create `packages/shared-react/src/contexts/calendar/` module with `createCalendarContext` factory that accepts query, mutations, subscription adapters
- [x] 9.5 Refactor `apps/web/app/(app)/calendar/context.tsx` to a thin wrapper calling `createCalendarContext`
- [x] 9.6 Update `packages/shared-react/src/hooks/index.ts` and `src/contexts/index.ts` to export calendar
- [x] 9.7 Verify web builds and calendar functionality works unchanged

## 10. Shared Archive Hooks & Context

- [x] 10.1 Create `packages/shared-react/src/hooks/archive/` module with `createArchiveHooks` factory (`useArchiveImportQuery`, `useArchiveImportMutation`, `useArchiveCache`, `useArchiveImportSubscription`)
- [x] 10.2 Create `apps/web/hooks/archive/shared-archive-hooks.ts` binding file
- [x] 10.3 Update web archive hook barrel to re-export from shared hooks
- [x] 10.4 Create `packages/shared-react/src/contexts/archive/` module with `createArchiveImportContext` factory
- [x] 10.5 Refactor `apps/web/context/archive-import-context.tsx` to a thin wrapper calling `createArchiveImportContext`
- [x] 10.6 Update `packages/shared-react/src/hooks/index.ts` and `src/contexts/index.ts` to export archive
- [x] 10.7 Verify web builds and archive import functionality works unchanged

## 11. Recipe Detail Context

- [x] 11.1 Create `packages/shared-react/src/contexts/recipe-detail/` module with `createRecipeDetailContext` factory that wires query, subscription, nutrition, auto-tagging, allergy detection via adapters (all underlying hooks are already shared)
- [x] 11.2 Refactor `apps/web/app/(app)/recipes/[id]/context.tsx` to a thin wrapper calling `createRecipeDetailContext`
- [x] 11.3 Verify web builds and recipe detail page works unchanged

## 12. Extend Config Hooks & Standalone Hooks

- [x] 12.1 Move `use-version-query` to `packages/shared-react/src/hooks/config/`
- [x] 12.2 Update `createConfigHooks` factory to include `useVersionQuery` in its return
- [x] 12.3 Update web config hook barrel to re-export version query from shared hooks
- [x] 12.4 Move `use-amount-display-preference` to `packages/shared-react/src/hooks/` (verify no browser API deps)
- [x] 12.5 Move `use-recurrence-detection` to `packages/shared-react/src/hooks/` (verify no browser API deps)
- [x] 12.6 Update `packages/shared-react/src/hooks/index.ts` to export new hooks
- [x] 12.7 Update web imports to use shared-react exports
- [x] 12.8 Verify web builds and all hooks work unchanged

## 13. Admin & CalDAV Hooks & Contexts (Web-Only, Prepare for Sharing)

- [x] 13.1 Create `packages/shared-react/src/hooks/admin/` module with `createAdminHooks` factory (`useAdminQuery`, `useAdminMutations`)
- [x] 13.2 Create `apps/web/hooks/admin/shared-admin-hooks.ts` binding file
- [x] 13.3 Update web admin hook barrel to re-export from shared hooks
- [x] 13.4 Create `packages/shared-react/src/contexts/admin/` module with `createAdminSettingsContext` factory (query + mutations via adapters)
- [x] 13.5 Refactor `apps/web/app/(app)/settings/admin/context.tsx` to a thin wrapper calling `createAdminSettingsContext`
- [x] 13.6 Create `packages/shared-react/src/hooks/caldav/` module with `createCaldavHooks` factory (`useCaldavQuery`, `useCaldavMutations`, `useCaldavCache`, `useCaldavSubscription`)
- [x] 13.7 Create `apps/web/hooks/caldav/shared-caldav-hooks.ts` binding file
- [x] 13.8 Update web caldav hook barrel to re-export from shared hooks
- [x] 13.9 Create `packages/shared-react/src/contexts/caldav/` module with `createCaldavSettingsContext` factory (queries, mutations, subscription, toast adapter)
- [x] 13.10 Refactor `apps/web/app/(app)/settings/caldav/context.tsx` to a thin wrapper calling `createCaldavSettingsContext`
- [x] 13.11 Update `packages/shared-react/src/hooks/index.ts` and `src/contexts/index.ts` to export admin and caldav
- [x] 13.12 Verify web builds and admin/caldav features work unchanged

## 14. Final Verification & Cleanup

- [x] 14.1 Run full test suite for `packages/shared-react` (existing tests + new export tests)
- [x] 14.2 Run full web app build to verify no broken imports
- [x] 14.3 Run full mobile app build to verify no broken imports
- [x] 14.4 Verify shared-react package.json exports are updated if needed
- [x] 14.5 Remove any dead code from app directories that was fully replaced by shared-react
