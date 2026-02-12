# User Preferences (2026-02-11)

## Summary

Add a per-user preferences system stored as a JSONB column on the `user` table. The feature now exposes multiple user-level preferences (initially `timersEnabled` and `showConversionButton`). Preferences are surfaced via the `user.get` API and may be updated with the `user.updatePreferences` mutation. Server-side updates merge incoming partial preference objects with the existing stored JSON (merge-by-key). The UI honors global server configuration (e.g. timers may be globally disabled) and the client performs optimistic updates when toggling preferences.

## Key changes (current implemented state)

- DB migration: added `preferences` jsonb column to `user` table (default `{}`).
- Zod schemas:
  - `UserPreferencesSchema` (preference shape)
  - `UpdatePreferencesInputSchema` (mutation input)
- Repository: `getUserPreferences(userId)` and `updateUserPreferences(userId, preferences)`.
- API:
  - `user.get` returns `user.preferences` (as stored JSON).
  - `user.updatePreferences` mutation accepts a partial preferences object and returns `{ success: boolean, preferences }` where `preferences` is the merged result.
- Frontend/UI:
  - `PreferencesCard` in User Settings exposes toggles for `timersEnabled` and `showConversionButton`.
  - `useUserSettingsContext` / `use-user-mutations` provides `updatePreferences(preferences)` which performs optimistic cache updates and calls the `user.updatePreferences` mutation.
- Client merging/behavior:
  - The server merges current preferences with the incoming partial object: `merged = { ...(current ?? {}), ...(input.preferences ?? {}) }`.
  - `useTimersEnabledQuery` (and related UI) computes effective timers availability as `globalEnabled && (typeof userPref === 'boolean' ? userPref : true)`.
  - When global config disables a capability (e.g. timers), the UI hides or disables the corresponding toggle regardless of the user preference.

## Verification

- Unit tests cover:
  - `user.get` including returning `preferences` when present.
  - `user.updatePreferences` merging behavior and that the repository is called with the merged object.
  - Frontend `PreferencesCard` UI states for user-level true/false and global-enabled/disabled scenarios.
- Integration/Manual checks:
  - Toggle a preference in `PreferencesCard` and confirm optimistic UI switches state, then server persists the merged preferences.
  - Confirm `showConversionButton` is respected where used (e.g. recipe conversion UI).
