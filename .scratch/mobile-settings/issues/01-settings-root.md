# 01: Settings root, entry and App section

**What to build:** Replace the Settings tab with a pushed Settings page opened from the avatar menu's "All settings", drawn as `StPage` `screen=root`. Build the shared settings list pieces the later tickets use: grouped section, settings row with swipe actions and long-press menu (`native-menu`), sub-page nav title, offline disabling. Fill the App section and Sign out.

**Blocked by:** none

**Status:** done

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

### Review round 1 (2026-11-23): dispositions

Standards (Haiku; Gemini Hydrogen was refused by its provider):
- fix: comments over two lines (`settings-row.tsx:94`, `native-menu.tsx:37`).
- verify: `discard-confirm.ts` comment claims Change server uses the rule; fix the comment or the caller, and name the Outbox.
- fix: tone-to-colour mapped three times in `settings-row.tsx`; one resolver, swipe actions in their own file.
- fix: names `VectorIcon` (is Ionicons), `hex` (returns value or undefined); drop `actionsEnabled` if it stays `!offline`.
- fix: surface wrapper repeated in `settings-screen.tsx`; an untitled `SettingsGroup` covers it.
- verify: Offline long press may open an empty menu.
- reject: `confirmsDiscard` as Middle Man (the spec's Testing Decisions ask for the rule as a tested plain module).
- reject: seven identical route files into `[section].tsx` (tickets 02-05 replace each placeholder).
- reject: `ProfileCard` props as a Data Clump (three display props keep the card free of the session type).
- reject: `accessory` union and `/settings/${path}` as Primitive Obsession (already a typed union; typed routes check the path).
- reject: Feature Envy on the row reading connectivity (the spec puts Offline disabling in the shared row).

Spec (Sol medium):
- fix: Version reads `expoConfig.ios.buildNumber ?? "0"`; show the installed binary's version and build, never a made-up one, and don't truncate the server version.
- verify: swipe excludes Copy (`row-actions.ts:29`) against the canvas's share-links swiped board; ticket 05 lists Copy link.
- fix: a row whose press is a write stays tappable Offline; the row gets one way to mark that, tested.
- verify, bug: a second Server tap during sign-out can clear the redirect to the server address.
- verify: long-press preview may lift the row at the highlight's 0.4 alpha.
- fix: Maestro sign-out flow scrolls to `settings-sign-out` before tapping.

Outcome: fixed in `70eb6e444`, `ef56c8331`, `86ab7bead` (second Server tap, confirmed with a failing test), `3951c150b` (dimmed preview, confirmed by reading; device check in 06), `7851ca227`, `7a817b3ff` (Version via `expo-application`, messages merged into `versionServer`). Copy stays out of the swipe: the canvas shows it only in the long-press menu. Exit gates all 0 at `7a817b3ff`. Not run: the iOS compile of the Swift change and `expo-application` (another session's device runner held xcodebuild); retried during ticket 02.
