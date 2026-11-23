# 01: Settings root, entry and App section

**What to build:** Replace the Settings tab with a pushed Settings page opened from the avatar menu's "All settings", drawn as `StPage` `screen=root`. Build the shared settings list pieces the later tickets use: grouped section, settings row with swipe actions and long-press menu (`native-menu`), sub-page nav title, offline disabling. Fill the App section and Sign out.

**Blocked by:** none

**Status:** ready-for-agent

- [x] `(tabs)/settings.tsx` removed; Settings is a pushed route with a back button, reached from "All settings" on every tab.
- [x] Root sections drawn per the canvas; Profile, Household and Connections rows navigate to placeholder sub-pages the later tickets fill.
- [x] Shared settings row: swipe actions (34 pt circles, 11 pt labels, content shrinks with ellipsis) and long-press glass menu with icons, colours per the spec.
- [x] App section: Server opens the server-address flow; Support opens the browser; Version shows app version and build plus the server version.
- [x] Sign out and change server confirm only with unsynced Outbox changes ("Discard unsynced changes?"), unit-tested rule.
- [x] Offline: cached data shows, actions disabled, Offline capsule shown.
- [x] Gates green.

## Comments

- Settings is the nested stack `app/settings/` (index plus placeholder pages for profile, preferences, allergies, household, tokens, api-keys, share-links); `(tabs)/settings` and its tab are gone, and the Maestro sign-out flow now goes avatar menu, All settings, `settings-sign-out`. The canvas's Privacy policy row is left out (out of scope in the spec).
- Shared pieces for tickets 02-05: `features/settings/components/settings-page.tsx` (back header, scroll, Offline capsule), `settings-group.tsx`, `settings-row.tsx` (swipe circles + long-press menu, off Offline), rules in `utils/row-actions.ts`; fill a page by replacing its route's `SettingsPlaceholderScreen`.
- `native-menu` gained `onPress` (long-press mode, the lifted view is the row) and per-item `tint`; the Swift only parses (`swiftc -parse`), so the long-press lift and tinted icons need the device check. Rule: `lib/discard-confirm.ts`; Sign out and Change server stay enabled Offline, as before.
- Added `useServerVersionQuery` to shared-react for the Version row. Docs writer: Settings now opens from the avatar menu (the tab is gone) and Version shows the server's too.
