## Context

Norish stores user locale in a dedicated `locale` text column and other preferences in a JSONB `preferences` column on the `user` table. There are separate tRPC procedures (`getLocale`/`setLocale`) and repository functions (`getUserLocale`/`updateUserLocale`) for locale management, while all other preferences flow through `updatePreferences`. Language selection is only available in the navbar user menu -- not on the settings page. The user wants to consolidate locale into the JSONB preferences, add a settings-page language selector, and keep both UI surfaces in sync across devices.

## Goals / Non-Goals

- Goals:
  - Consolidate locale into the JSONB `preferences` column alongside other user preferences
  - Remove the dedicated `locale` column and its separate API surface
  - Add a language dropdown to the user settings PreferencesCard
  - Both user menu and settings page read/write the same preference, staying in sync
  - Changes sync across devices via the existing DB-backed preference + React Query invalidation pattern

- Non-Goals:
  - Changing how unauthenticated users handle locale (cookie-based, unchanged)
  - Adding new languages or changing the locale config admin system
  - Changing the theme switch behavior

## Decisions

- **Store locale in JSONB preferences**: The `locale` value moves from a dedicated column into `preferences.locale`. This unifies all user preferences in one place and simplifies the API surface. The JSONB merge pattern (`coalesce || updates`) already handles partial updates safely.
  - Alternative considered: Keep `locale` as a separate column but expose it through the preferences API. Rejected because it adds unnecessary indirection without benefit.

- **Single migration with two steps**: One migration file that (1) copies `locale` into `preferences.locale` for all users who have a locale set, then (2) drops the `locale` column. This is safe because the column is nullable and the JSONB default is `'{}'::jsonb`.
  - Alternative considered: Two separate migrations with a deprecation period. Rejected as overkill for a self-hosted app with controlled releases.

- **Remove `getLocale`/`setLocale` tRPC procedures**: Replace with `preferences` field from the existing `user.get` query and `user.updatePreferences` mutation. The `useLocale()` hook already reads from a tRPC query; it just needs to read from the user preferences query instead of a separate locale query.
  - Alternative considered: Keep `getLocale`/`setLocale` as thin wrappers around preferences. Rejected to avoid maintaining two paths for the same data.

- **Sync mechanism**: Both the navbar `<LanguageSwitch />` and the settings `PreferencesCard` dropdown will call `updatePreferences({ locale })`. The user query cache invalidation already happens after `updatePreferences` mutations, so both surfaces reflect changes immediately. Cross-device sync relies on the existing staleTime/refetch strategy on the user query.

## Risks / Trade-offs

- **Breaking migration**: Dropping the `locale` column is irreversible. => Mitigation: The migration copies data first; users should back up the DB before upgrading (standard practice for self-hosted).
- **Server-side locale resolution**: If any server middleware reads the `locale` column directly (outside the repository), it will break. => Mitigation: Search for all references to `locale` column in server code before implementing; update any direct DB reads to use the preferences JSONB extraction.

## Open Questions

- None identified. The scope is well-defined and contained within existing patterns.
