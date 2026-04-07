# Mutation Audit Matrix — Delayed-Delivery Safety

## Classification Key

| Label             | Meaning                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `already-safe`    | Contract already carries explicit state/snapshot and version is enforced (or N/A)                    |
| `migrate-now`     | Can be made safe in this change by adding version enforcement, explicit state, or snapshot semantics |
| `exclude-for-now` | Excluded from first delayed-delivery allowlist (create-style, mutable-lookup, or repeat-work)        |

---

## 1. Favorites

| Mutation           | Current Shape                                                                                  | Issue                              | Classification  | Migration                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------- | --------------- | -------------------------------------------------------------------------- |
| `favorites.toggle` | Backend-derived toggle: reads current row to decide insert vs delete; `_version` param ignored | Late delivery flips to wrong state | **migrate-now** | Replace with `favorites.set` accepting `{ recipeId, isFavorite, version }` |

## 2. Ratings

| Mutation       | Current Shape                                                     | Issue                                 | Classification  | Migration                                                                                             |
| -------------- | ----------------------------------------------------------------- | ------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `ratings.rate` | Upsert `{ recipeId, rating, version }`; `_version` ignored in SQL | Late delivery overwrites newer rating | **migrate-now** | Enforce version CAS on update path; insert path is already safe (first-write idempotent via conflict) |

## 3. Groceries

| Mutation                   | Current Shape                                                                                                                        | Issue                                     | Classification      | Migration                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ------------------- | -------------------------------------------------------------------------- |
| `groceries.create`         | Creates new grocery rows; generates UUIDs server-side                                                                                | Late delivery could duplicate             | **exclude-for-now** | —                                                                          |
| `groceries.update`         | Accepts `{ groceryId, raw, version }` but `updateGroceries` ignores version in WHERE                                                 | Late delivery overwrites                  | **migrate-now**     | Add version CAS to `updateGroceries`                                       |
| `groceries.toggle`         | Accepts `{ groceries: [{id, version}], isDone }` — already explicit final-state; `updateGroceries` ignores version                   | Version not enforced                      | **migrate-now**     | Add version CAS to `updateGroceries`; explicit `isDone` is already correct |
| `groceries.delete`         | Accepts `{ groceries: [{id, version}] }` but `deleteGroceryByIds` ignores version                                                    | Late delete could hit wrong row           | **migrate-now**     | Add version CAS to `deleteGroceryByIds`                                    |
| `groceries.assignToStore`  | Accepts `{ groceryId, storeId, version }` but `assignGroceryToStore` ignores `_version`                                              | Late delivery re-assigns                  | **migrate-now**     | Add version CAS to `assignGroceryToStore`                                  |
| `groceries.reorderInStore` | Accepts `{ id, version, sortOrder }[]` but `reorderGroceriesInStore` ignores version in WHERE                                        | Late delivery scrambles order             | **migrate-now**     | Add version CAS to `reorderGroceriesInStore`                               |
| `groceries.markAllDone`    | Accepts `{ storeId, groceries: [{id, version}] }` — snapshot-based; server filters by groceryIds but doesn't enforce per-row version | Near-safe but stale rows could be marked  | **migrate-now**     | Enforce per-row version CAS in `markAllDoneInStore`                        |
| `groceries.deleteDone`     | Accepts `{ storeId, groceries: [{id, version}] }` — snapshot-based; server filters by groceryIds but doesn't enforce per-row version | Near-safe but stale rows could be deleted | **migrate-now**     | Enforce per-row version CAS in `deleteDoneInStore`                         |

## 4. Recurring Groceries

| Mutation                             | Current Shape                                                                                                           | Issue                                                   | Classification      | Migration                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------- | -------------------------------------------------------------------- |
| `recurringGroceries.createRecurring` | Creates new recurring + grocery rows                                                                                    | Duplicate creation risk                                 | **exclude-for-now** | —                                                                    |
| `recurringGroceries.updateRecurring` | Accepts `{ recurringVersion, groceryVersion }` but `updateRecurringGrocery` and `updateGrocery` ignore version in WHERE | Late delivery overwrites                                | **migrate-now**     | Add version CAS to both `updateRecurringGrocery` and `updateGrocery` |
| `recurringGroceries.deleteRecurring` | Accepts `{ version }` but `deleteRecurringGroceryById` ignores version                                                  | Late delete                                             | **migrate-now**     | Add version CAS to `deleteRecurringGroceryById`                      |
| `recurringGroceries.checkRecurring`  | Accepts explicit `isDone` + `{ recurringVersion, groceryVersion }` but versions ignored in SQL                          | Near-safe (explicit `isDone`) but stale writes possible | **migrate-now**     | Add version CAS to `updateGrocery` and `updateRecurringGrocery`      |

## 5. Stores

| Mutation         | Current Shape                                                                                              | Issue                                 | Classification      | Migration                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `stores.create`  | Creates new store row                                                                                      | Duplicate creation risk               | **exclude-for-now** | —                                                                                                                       |
| `stores.update`  | Accepts `StoreUpdateDto` (has `id`, version via schema) but `updateStore` ignores version in WHERE         | Late delivery overwrites              | **migrate-now**     | Add version CAS to `updateStore`                                                                                        |
| `stores.delete`  | Accepts `{ storeId, deleteGroceries: boolean }` — live-state-dependent: queries current groceries in store | Late delivery deletes wrong groceries | **migrate-now**     | Accept store version + grocery snapshot `[{id, version}]`; only process snapshot rows; delete store only if empty after |
| `stores.reorder` | Accepts `{ stores: [{id}] }` (just IDs, no versions); `reorderStores` ignores version in WHERE             | Late delivery scrambles order         | **migrate-now**     | Add version CAS to `reorderStores`                                                                                      |

## 6. Households

| Mutation                    | Current Shape                                                                                                      | Issue                                      | Classification      | Migration                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------- | -------------------------------------------- |
| `households.create`         | Creates new household row                                                                                          | Duplicate creation risk                    | **exclude-for-now** | —                                            |
| `households.join`           | Resolves mutable join code at delivery time                                                                        | Late delivery could join wrong household   | **exclude-for-now** | —                                            |
| `households.leave`          | Accepts `{ householdId, version }` but `removeUserFromHousehold` ignores `_version`                                | Late delivery could leave after re-joining | **migrate-now**     | Add version CAS to `removeUserFromHousehold` |
| `households.kick`           | Accepts `{ householdId, userId, version }` but `kickUserFromHousehold` → `removeUserFromHousehold` ignores version | Late kick of re-joined user                | **migrate-now**     | Add version CAS                              |
| `households.regenerateCode` | Accepts `{ householdId, version }` but `regenerateJoinCode` ignores `_version`                                     | Late delivery regenerates again            | **migrate-now**     | Add version CAS to `regenerateJoinCode`      |
| `households.transferAdmin`  | Accepts `{ householdId, newAdminId, version }` but `transferHouseholdAdmin` ignores `_version`                     | Late delivery transfers to wrong user      | **migrate-now**     | Add version CAS to `transferHouseholdAdmin`  |

## 7. Calendar

| Mutation              | Current Shape                                                                   | Issue                                  | Classification      | Migration                              |
| --------------------- | ------------------------------------------------------------------------------- | -------------------------------------- | ------------------- | -------------------------------------- |
| `calendar.createItem` | Creates new planned item                                                        | Duplicate creation risk                | **exclude-for-now** | —                                      |
| `calendar.moveItem`   | Accepts `{ itemId, version, ... }` but `moveItem` ignores `_version`            | Late delivery moves already-moved item | **migrate-now**     | Add version CAS to `moveItem`          |
| `calendar.updateItem` | Accepts `{ itemId, title, version }` but `updatePlannedItem` ignores `_version` | Late delivery overwrites               | **migrate-now**     | Add version CAS to `updatePlannedItem` |
| `calendar.deleteItem` | Accepts `{ itemId, version }` but `deletePlannedItem` ignores `_version`        | Late delivery deletes wrong item       | **migrate-now**     | Add version CAS to `deletePlannedItem` |

## 8. Recipes

| Mutation                      | Current Shape                                                                | Issue                    | Classification  | Migration                                   |
| ----------------------------- | ---------------------------------------------------------------------------- | ------------------------ | --------------- | ------------------------------------------- |
| `recipes.update`              | Accepts `{ recipeId, version, ... }` — version not enforced in repo          | Late delivery overwrites | **migrate-now** | Add version CAS to `updateRecipeWithRefs`   |
| `recipes.updateCategories`    | Accepts `{ recipeId, version, ... }` — version not enforced                  | Late delivery overwrites | **migrate-now** | Add version CAS to `updateRecipeCategories` |
| `recipes.delete`              | Accepts `{ recipeId, version }` — version not enforced in `deleteRecipeById` | Late delete              | **migrate-now** | Add version CAS to `deleteRecipeById`       |
| `recipes.convertMeasurements` | Accepts `{ recipeId, version, ... }` — version not enforced                  | Late delivery overwrites | **migrate-now** | Add version CAS                             |
| `recipes.deleteGalleryImage`  | Accepts `{ imageId, version }` — `deleteRecipeImageById` ignores `_version`  | Late delete              | **migrate-now** | Add version CAS                             |
| `recipes.deleteGalleryVideo`  | Accepts `{ videoId, version }` — `deleteRecipeVideoById` ignores `_version`  | Late delete              | **migrate-now** | Add version CAS                             |

## 9. User / Profile

| Mutation                 | Current Shape                                                                                                                                                | Issue                            | Classification  | Migration                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | --------------- | ------------------------------------------- |
| `user.updatePreferences` | Accepts `{ preferences, version }` but version not enforced in `updateUserPreferences`                                                                       | Late delivery overwrites         | **migrate-now** | Add version CAS to `updateUserPreferences`  |
| `user.updateName`        | Accepts `{ name, version }` but version not enforced in `updateUserName`                                                                                     | Late delivery overwrites         | **migrate-now** | Add version CAS to `updateUserName`         |
| `user.uploadAvatar`      | FormData with `version` — version not enforced                                                                                                               | Late delivery overwrites         | **migrate-now** | Add version CAS to `updateUserAvatar`       |
| `user.deleteAvatar`      | Accepts `{ version }` — version not enforced in `clearUserAvatar`                                                                                            | Late delete                      | **migrate-now** | Add version CAS to `clearUserAvatar`        |
| `user.setAllergies`      | Accepts `{ allergies, version }` — `updateUserAllergies` does version tracking but not CAS enforcement (reads version, increments, but doesn't reject stale) | Late delivery replaces newer set | **migrate-now** | Add true CAS check in `updateUserAllergies` |

## 10. CalDAV

| Mutation              | Current Shape                                                                                                              | Issue                          | Classification      | Migration                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------- | --------------------------------------- |
| `caldav.saveConfig`   | Accepts `{ version, ...config }` — `saveCaldavConfig` uses `onConflictDoUpdate` but ignores version in conflict resolution | Late delivery overwrites       | **migrate-now**     | Add version CAS to `saveCaldavConfig`   |
| `caldav.deleteConfig` | Accepts `{ version }` — `deleteCaldavConfig` ignores `_version`                                                            | Late delete                    | **migrate-now**     | Add version CAS to `deleteCaldavConfig` |
| `caldav.triggerSync`  | No input, triggers retry of failed syncs                                                                                   | Repeat-work, non-deterministic | **exclude-for-now** | —                                       |
| `caldav.syncAll`      | No input, triggers full sync                                                                                               | Repeat-work, non-deterministic | **exclude-for-now** | —                                       |

## 11. Site Auth Tokens

| Mutation                | Current Shape                                                                    | Issue                    | Classification  | Migration                                |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------------ | --------------- | ---------------------------------------- |
| `siteAuthTokens.update` | Accepts `{ id, version?, ... }` — `updateSiteAuthToken` ignores version in WHERE | Late delivery overwrites | **migrate-now** | Add version CAS to `updateSiteAuthToken` |
| `siteAuthTokens.remove` | Accepts `{ id, version }` — `deleteSiteAuthToken` ignores `_version`             | Late delete              | **migrate-now** | Add version CAS to `deleteSiteAuthToken` |

---

## Summary

| Classification      | Count | Domains                                                                                                                                                          |
| ------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **already-safe**    | 0     | —                                                                                                                                                                |
| **migrate-now**     | 35    | favorites, ratings, groceries, recurring groceries, stores, households, calendar, recipes, user/profile, CalDAV, site-auth-tokens                                |
| **exclude-for-now** | 8     | groceries.create, recurringGroceries.createRecurring, stores.create, households.create, households.join, calendar.createItem, caldav.triggerSync, caldav.syncAll |

## First Delayed-Delivery Allowlist

After migration, the following mutation families will be eligible for delayed delivery:

1. **Favorites**: `set` (replacing `toggle`)
2. **Ratings**: `rate` (version-enforced)
3. **Groceries**: `update`, `toggle`, `delete`, `assignToStore`, `reorderInStore`, `markAllDone`, `deleteDone`
4. **Recurring Groceries**: `updateRecurring`, `deleteRecurring`, `checkRecurring`
5. **Stores**: `update`, `delete` (snapshot-based), `reorder`
6. **Households**: `leave`, `kick`, `regenerateCode`, `transferAdmin`
7. **Calendar**: `moveItem`, `updateItem`, `deleteItem`
8. **Recipes**: `update`, `updateCategories`, `delete`, `convertMeasurements`, `deleteGalleryImage`, `deleteGalleryVideo`
9. **User/Profile**: `updatePreferences`, `updateName`, `uploadAvatar`, `deleteAvatar`, `setAllergies`
10. **CalDAV**: `saveConfig`, `deleteConfig`
11. **Site Auth Tokens**: `update`, `remove`

## Excluded from First Allowlist (Immediate-Only)

- `groceries.create`
- `recurringGroceries.createRecurring`
- `stores.create`
- `households.create`
- `households.join`
- `calendar.createItem`
- `caldav.triggerSync`
- `caldav.syncAll`
