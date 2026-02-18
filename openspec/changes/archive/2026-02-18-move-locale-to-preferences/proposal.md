# Change: Move locale into user preferences and add language selector to settings

## Why

The user table has a dedicated `locale` text column and a separate JSONB `preferences` column. Locale is conceptually a user preference and should live alongside `timersEnabled` and `showConversionButton` in the JSONB column. Additionally, language can currently only be changed from the navbar user menu -- the user settings page should also offer a language dropdown that stays in sync with the menu and syncs across devices.

## What Changes

- **BREAKING**: Remove the dedicated `locale` text column from the `user` table; migrate existing values into `preferences.locale`
- Add `locale` to the `UpdatePreferencesInputSchema` and `UserPreferencesDto`
- Replace `getLocale`/`setLocale` tRPC procedures with reads/writes through the existing `updatePreferences` flow
- Update `useLocale()` hook to read/write locale from the JSONB preferences
- Add a language dropdown to the user settings `PreferencesCard`
- Ensure language changes from either the user menu or settings page update the same preference and reflect immediately in both locations

## Impact

- Affected specs: `user-preferences` (new capability spec)
- Affected code:
  - `server/db/schema/auth.ts` (remove `locale` column)
  - `server/db/repositories/users.ts` (remove `getUserLocale`/`updateUserLocale`, update `getUserPreferences`)
  - `server/trpc/routers/user/user.ts` (remove `getLocale`/`setLocale` procedures)
  - `server/trpc/routers/user/types.ts` (add `locale` to preferences schema)
  - `server/db/zodSchemas/user-preferences.ts` (add `locale`)
  - `lib/user-preferences.ts` (add locale helper)
  - `hooks/user/use-locale.ts` (read from preferences instead of dedicated endpoint)
  - `hooks/user/use-language-switch.tsx` (adapt to new locale source)
  - `app/(app)/settings/user/components/preferences-card.tsx` (add language dropdown)
  - New migration: copy `locale` into `preferences.locale`, then drop column
