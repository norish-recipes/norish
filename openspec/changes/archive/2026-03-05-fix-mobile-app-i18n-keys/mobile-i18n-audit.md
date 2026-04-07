## Task 1 Audit: Mobile i18n Key Inventory and Mapping

## 1.1 Inventory Results (`apps/mobile`)

- Translation key call sites in mobile UI (`formatMessage`, `FormattedMessage`, `useIntl` key lookups): **none found**.
- Current user-visible copy is primarily hardcoded string literals in route screens and UI components.
- Audit scope for this pass: auth routes/components, tab routes/layout headers, recipe/search/filter surfaces, settings menu, swipe actions, and shared tab accessory labels.

### Audited files

- `apps/mobile/src/app/(auth)/index.tsx`
- `apps/mobile/src/app/(auth)/auth/error.tsx`
- `apps/mobile/src/app/(auth)/login.tsx`
- `apps/mobile/src/app/(auth)/register.tsx`
- `apps/mobile/src/app/(tabs)/dashboard/_layout.tsx`
- `apps/mobile/src/app/(tabs)/dashboard/index.tsx`
- `apps/mobile/src/app/(tabs)/dashboard/[id].tsx`
- `apps/mobile/src/app/(tabs)/search/_layout.tsx`
- `apps/mobile/src/app/(tabs)/search/index.tsx`
- `apps/mobile/src/app/(tabs)/profile/index.tsx`
- `apps/mobile/src/app/(tabs)/calendar/index.tsx`
- `apps/mobile/src/app/(tabs)/groceries/index.tsx`
- `apps/mobile/src/components/auth/login/*.tsx`
- `apps/mobile/src/components/search/filter-sheet.tsx`
- `apps/mobile/src/components/shell/settings-menu.tsx`
- `apps/mobile/src/components/shell/tab-bottom-accessory.tsx`
- `apps/mobile/src/components/shell/sheet/import-from-url-sheet.tsx`
- `apps/mobile/src/components/shell/sheet/start-from-scratch-sheet.tsx`
- `apps/mobile/src/components/home/swipeable-recipe-row.tsx`
- `apps/mobile/src/components/home/recipe-card-metrics.tsx`
- `apps/mobile/src/components/shell/simple-tab-screen.tsx`

## 1.2 Key Mapping Decisions

Legend:

- `reuse`: use existing key in `packages/i18n`
- `new`: add key (no suitable existing key)

| Surface                        | Current copy                                          | Target key                                                       | Action     | Notes                                                          |
| ------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| Auth shell/login               | Sign in to                                            | `auth.login.title`                                               | reuse      | Exact match                                                    |
| Login form                     | Email                                                 | `auth.emailPassword.email`                                       | reuse      | Exact match                                                    |
| Login form                     | Password                                              | `auth.emailPassword.password`                                    | reuse      | Exact match                                                    |
| Login form/button              | Signing in...                                         | `common.status.loading` (or new auth submitting key)             | reuse/new  | Prefer auth-specific key for better UX copy                    |
| Login form/button              | Sign in with password                                 | `auth.emailPassword.signIn`                                      | reuse      | Semantically equivalent                                        |
| Login footer                   | Don't have an account?                                | `auth.emailPassword.noAccount`                                   | reuse      | Exact match                                                    |
| Login footer                   | Sign up                                               | `auth.emailPassword.signUp`                                      | reuse      | Exact match                                                    |
| OAuth button                   | Continue with {provider}                              | `auth.provider.signInWith`                                       | reuse      | Copy can be standardized to "Sign in with"                     |
| OAuth button active            | Opening provider...                                   | `auth.login.redirectMessage` (or new)                            | reuse/new  | Existing copy is close but not identical                       |
| Providers loading              | Loading sign-in methods...                            | `common.status.loading` + new auth detail                        | new        | Needs auth-specific loading text                               |
| No providers title             | No sign-in methods available                          | `auth.login.noProviders.title`                                   | reuse      | Same intent                                                    |
| No providers body              | Authentication providers are not configured.          | `auth.login.noProviders.contactAdmin`                            | reuse      | Existing message can be adapted                                |
| Provider error title           | Could not load providers                              | `auth.errors.default.title` (or new)                             | reuse/new  | Better as auth-specific provider-load error                    |
| Provider error action          | Retry                                                 | `common.actions.retry`                                           | reuse      | Exact match                                                    |
| Register header                | Create account on                                     | `auth.signup.title`                                              | reuse      | Existing value is "Sign up for"; choose one canonical phrasing |
| Register field                 | Name                                                  | `auth.signup.name`                                               | reuse      | Exact match                                                    |
| Register field                 | Confirm password                                      | `auth.signup.confirmPassword`                                    | reuse      | Case normalize                                                 |
| Register validation            | Name is required.                                     | `common.validation.required` (or new field-specific)             | reuse/new  | Field-specific preferred                                       |
| Register validation            | Email is required.                                    | `common.validation.required` (or new field-specific)             | reuse/new  | Field-specific preferred                                       |
| Register validation            | Passwords do not match.                               | `auth.signup.errors.passwordMismatch`                            | reuse      | Exact match                                                    |
| Register validation            | Password must be at least/at most N characters.       | `auth.signup.errors.passwordTooShort` / `passwordTooLong`        | reuse      | Exact semantics                                                |
| Register failure               | Could not create account. / Please try again.         | `auth.signup.errors.createFailed` / `auth.signup.errors.generic` | reuse      | Exact intent                                                   |
| Register disabled title        | Registration unavailable                              | `auth.errors.registration_is_currently_disabled.title`           | reuse      | Same meaning                                                   |
| Register disabled body         | Ask your server administrator to enable registration. | `auth.errors.registration_is_currently_disabled.description`     | reuse      | Same intent                                                    |
| Connect heading                | Connect to                                            | `common.connection.connecting` family + new heading              | new        | No existing connect-heading key                                |
| Connect label                  | Backend URL                                           | new `auth.connect.backendUrlLabel`                               | new        | No suitable existing key                                       |
| Connect placeholder            | https://your-norish-server.com                        | new `auth.connect.backendUrlPlaceholder`                         | new        | Product-specific                                               |
| Connect button                 | Connect / Connecting...                               | new `auth.connect.connect` / `auth.connect.connecting`           | new        | Avoid overloading generic keys                                 |
| Connect validation             | Enter a valid URL like...                             | `common.validation.invalidUrl` + new example suffix              | reuse/new  | Compose or add specific key                                    |
| Connect errors                 | Connection timed out... / Could not connect...        | new `auth.connect.errors.*`                                      | new        | Auth-connect specific errors                                   |
| Auth error fallback            | The OAuth callback could not be completed.            | `auth.errors.default.description`                                | reuse      | Same failure domain                                            |
| Auth error title               | Sign-in failed                                        | `auth.errors.default.title`                                      | reuse      | Equivalent                                                     |
| Auth error                     | Error code: {code}                                    | `auth.errors.errorCode`                                          | reuse      | Exact match                                                    |
| Auth error action              | Try again                                             | `common.actions.retry`                                           | reuse      | Exact match                                                    |
| Auth error action              | Back to Connect                                       | new `auth.errors.backToConnect`                                  | new        | No existing key                                                |
| Dashboard header               | Recipes                                               | `recipes.dashboard.title`                                        | reuse      | Exact match                                                    |
| Dashboard section              | Today                                                 | `calendar.mobile.today`                                          | reuse      | Exact match                                                    |
| Dashboard action               | Calendar                                              | `calendar.page.title`                                            | reuse      | Exact match                                                    |
| Dashboard section              | Your Collection                                       | new `recipes.mobile.collectionTitle`                             | new        | No equivalent key                                              |
| Dashboard empty error          | Could not load recipes                                | new `recipes.mobile.loadFailed`                                  | new        | Needed in mobile flow                                          |
| Dashboard empty error body     | Pull to refresh or try again in a moment.             | new `recipes.mobile.loadFailedHint`                              | new        | No exact existing key                                          |
| Dashboard empty                | No recipes yet                                        | `recipes.empty.noResults` (or new)                               | reuse/new  | Better with new "empty collection" key                         |
| Dashboard empty body           | Add your first recipe...                              | new `recipes.mobile.emptyCollectionHint`                         | new        | Mobile-specific empty-state text                               |
| Search header title            | Search                                                | `common.actions.search`                                          | reuse      | Exact label                                                    |
| Search placeholder             | Search recipes                                        | `recipes.dashboard.searchRecipesPlaceholder`                     | reuse      | Same intent                                                    |
| Search empty                   | No recipes found                                      | `recipes.empty.noResults`                                        | reuse      | Exact match                                                    |
| Search empty hint              | Try a different ingredient, cuisine, or keyword.      | `recipes.empty.noResultsHint`                                    | reuse      | Similar intent                                                 |
| Search filters button          | Filters / Open filters                                | `common.filters.title` / `common.actions.filter`                 | reuse      | Existing keys                                                  |
| Filter sheet title             | Filters                                               | `common.filters.title`                                           | reuse      | Exact match                                                    |
| Filter sheet subtitle          | Narrow your recipe search                             | new `common.filters.subtitle`                                    | new        | No current key                                                 |
| Filter section                 | Cooking time                                          | `common.filters.cookingTime`                                     | reuse      | Exact match                                                    |
| Filter section                 | Category                                              | `common.filters.categories`                                      | reuse      | Normalize singular/plural                                      |
| Filter section                 | Favorites                                             | `common.filters.favorites`                                       | reuse      | Exact match                                                    |
| Filter chip                    | Favorites only                                        | new `common.filters.favoritesOnly`                               | new        | Missing key                                                    |
| Filter section                 | Min rating                                            | new `common.filters.minRating`                                   | new        | Missing key                                                    |
| Filter section                 | Tags / Search tags                                    | `common.filters.tags` / `common.filters.searchTags`              | reuse      | Exact match                                                    |
| Filter actions                 | Reset / Apply                                         | `common.actions.reset` / `common.actions.apply`                  | reuse      | Exact match                                                    |
| Settings menu                  | Settings                                              | `navbar.userMenu.settings.title`                                 | reuse      | Exact match                                                    |
| Settings menu                  | Theme                                                 | `navbar.theme.title`                                             | reuse      | Exact match                                                    |
| Theme options                  | System / Light / Dark                                 | `navbar.theme.system/light/dark`                                 | reuse      | Exact match                                                    |
| Settings menu action           | Profile                                               | `settings.user.profile.title`                                    | reuse      | Exact match                                                    |
| Tab accessory                  | Add Recipe                                            | `recipes.dashboard.addRecipe`                                    | reuse      | Exact match                                                    |
| Tab accessory                  | Add Grocery                                           | `groceries.page.addItem`                                         | reuse      | Singular variant acceptable                                    |
| Swipe delete alert             | Delete recipe                                         | `recipes.card.deleteRecipe`                                      | reuse      | Exact match                                                    |
| Swipe delete alert             | Remove "{name}" from your recipes?                    | `recipes.deleteModal.confirmMessage`                             | reuse      | Exact semantics                                                |
| Swipe delete alert actions     | Cancel / Delete                                       | `common.actions.cancel` / `common.actions.delete`                | reuse      | Exact match                                                    |
| Recipe metrics                 | Servings                                              | `recipes.form.servings`                                          | reuse      | Exact match                                                    |
| Recipe metrics                 | Time                                                  | new `recipes.mobile.timeLabel`                                   | new        | No standalone generic key                                      |
| Profile title                  | Profile                                               | `settings.user.profile.title`                                    | reuse      | Exact match                                                    |
| Profile hint                   | Signed in as                                          | new `auth.profile.signedInAs`                                    | new        | Missing key                                                    |
| Profile fallback user          | Unknown user                                          | new `auth.profile.unknownUser`                                   | new        | Missing key                                                    |
| Profile action                 | Sign out / Signing out...                             | new `auth.logout.signOut` / `auth.logout.signingOut`             | new        | Missing key family                                             |
| Profile signout error          | Could not sign out. Please try again.                 | new `auth.logout.error`                                          | new        | Missing key                                                    |
| Placeholder tabs               | Calendar / Groceries titles                           | `calendar.page.title` / `groceries.page.title`                   | reuse      | Exact match                                                    |
| Placeholder screen helper copy | Misc placeholder/testing copy                         | new `common.mobile.placeholder.*` or remove                      | new/remove | Prefer removing non-product placeholder copy                   |

## 1.3 Key Mapping Checklist Output

- This file is the canonical checklist for Task 1 and will drive Task Group 2 replacements.
- Reuse-first policy has been applied; every row is marked with `reuse` vs `new`.
- Next execution step (Task Group 2): replace hardcoded strings in code with key references from this mapping.

## Task 3 Verification: Locale Completeness and Duplicate-Key Check

### 3.1 Mobile-used keys completeness across locales

- Collected all `formatMessage({ id: ... })` IDs from `apps/mobile/src` after Task 2 updates.
- Verified each mobile-used ID exists in every locale folder under `packages/i18n/src/messages/*`.
- Result: **0 missing mobile-used keys** across `en`, `fr`, `es`, `de-formal`, `de-informal`, `ko`, `nl`, and `ru`.

### 3.2 Newly introduced key coverage

- Task 2 intentionally reused canonical keys and did not require adding new i18n keys.
- Result: no new key IDs were introduced in `packages/i18n`, therefore no additional locale backfills were required.

### 3.3 Duplicate near-equivalent key guard

- Ran package-level key consistency validation: `pnpm --filter @norish/i18n check:locale-keys`.
- Validation passed for all locales.
- Because no new keys were added in this pass, no duplicate near-equivalent keys were introduced.
