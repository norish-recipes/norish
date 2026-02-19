## 1. Database migration

- [x] 1.1 Create migration to copy `user.locale` into `user.preferences->>'locale'` for all rows where `locale IS NOT NULL`
- [x] 1.2 In the same migration, drop the `locale` column from the `user` table
- [x] 1.3 Update Drizzle schema in `server/db/schema/auth.ts` to remove the `locale` column

## 2. Backend: consolidate locale into preferences

- [x] 2.1 Add `locale` to the Zod preferences schema in `server/trpc/routers/user/types.ts` (`UpdatePreferencesInputSchema`)
- [x] 2.2 Add `locale` to `server/db/zodSchemas/user.ts` (`UserPreferencesSchema`) — note: `user-preferences.ts` did not exist; schema lives in `user.ts`
- [x] 2.3 Remove `getUserLocale` and `updateUserLocale` from `server/db/repositories/users.ts`
- [x] 2.4 Remove `getLocale` and `setLocale` procedures from `server/trpc/routers/user/user.ts`
- [x] 2.5 Add `getLocalePreference()` helper in `lib/user-preferences.ts`
- [x] 2.6 Update any server-side code that reads the `locale` column directly — updated `i18n/request.ts` to read from `getUserPreferences()` instead of the removed `getUserLocale()`

## 3. Frontend: update locale hooks

- [x] 3.1 Update `hooks/user/use-locale.ts` to read locale from the user preferences (via `user.get` query) instead of `trpc.user.getLocale`
- [x] 3.2 Update `hooks/user/use-locale.ts` to write locale via `trpc.user.updatePreferences` instead of `trpc.user.setLocale`
- [x] 3.3 Update `hooks/user/use-language-switch.tsx` to use the updated `useLocale()` hook (verified — no direct locale procedure calls)

## 4. Frontend: add language dropdown to settings

- [x] 4.1 Add a language dropdown to `app/(app)/settings/user/components/preferences-card.tsx` using the enabled locales from `useLocaleConfigQuery()`
- [x] 4.2 Wire the dropdown to call `updatePreferences({ locale })` on change
- [x] 4.3 Add translation keys for the language preference label/description in all locale message files (`i18n/messages/*/settings.json`)

## 5. Tests

- [x] 5.1 Update `__tests__/server/db/repositories/users-preferences.integration.test.ts` to cover locale in JSONB preferences
- [x] 5.2 Update `__tests__/trpc/user/user.test.ts` — no `getLocale`/`setLocale` tests existed; existing preferences tests already cover the `updatePreferences` flow
- [x] 5.3 Update `__tests__/app/settings/user/preferences-card.test.tsx` to cover the new language dropdown
- [x] 5.4 Update `__tests__/hooks/user/use-user-query.test.ts` and related hook tests — verified no references to old locale procedures

## 6. Validation

- [x] 6.1 Run `pnpm test:run` and verify all tests pass — 117 files, 1898 tests all passing
- [x] 6.2 Run `pnpm build` and verify no type errors — compilation succeeds; a pre-existing SSR error (`useUserContext must be used within UserProvider`) occurs during static page generation on the base branch as well
- [ ] 6.3 Manual verification: change language from user menu, confirm settings page reflects it
- [ ] 6.4 Manual verification: change language from settings page, confirm user menu reflects it
