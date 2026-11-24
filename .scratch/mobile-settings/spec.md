# Mobile Settings

Status: ready-for-agent

Settled in a `/grill-with-docs` session on 2026-11-23. The design is the Settings page of the "Norish iOS" canvas (https://claude.ai/artifact/PXzHGxBxCU4MmwF8scvixz#page-settings, Version 117): base boards `StPage` (tweaks `screen`, `overlay`, `state`) and the St* boards importing it, each light and dark. Vocabulary is CONTEXT.md's: **Reader**, **Avatar**, **Device Kind**, **Device Preference**, **Hidden Item**, **Offline**, **Outbox**. Branch `rc/0.28.0-beta`, Target Version 0.28.0-beta. Goal: the last missing screens before the app goes to internal TestFlight testers (no App Review needed for that).

## Problem Statement

The mobile Settings screen is a 25-line placeholder. A reader on the phone cannot change their name or photo, manage sign-in methods, delete their account, set preferences or allergies, run their household, or manage site tokens, API keys and share links, so the app cannot replace the web for daily use.

## Solution

Settings becomes a pushed page opened from the avatar menu's "All settings", with Profile, Household, Connections and App sections and Sign out. Each section mirrors the web settings cards (`apps/web/features/account`, `apps/web/features/household`, `apps/web/components/settings/share-links-table-card.tsx`) on the same shared-react hooks, drawn as iOS grouped lists.

## User Stories

1. As a reader, I want Settings in the avatar menu on every tab, so that I find it the same way everywhere.
2. As a reader, I want to change my name and photo, or remove the photo, so that my household recognises me.
3. As a reader, I want to change my password, so that I can keep my account safe from the phone.
4. As a reader, I want to link and unlink sign-in methods from the phone, so that I can add my identity provider without a computer.
5. As a reader, I want to delete my account from the app, so that leaving Norish does not need the web.
6. As a reader, I want my phone Device Preferences and my measurements choice in Preferences, so that the app shows what I care about.
7. As a reader, I want to set my allergies, so that recipes warn me.
8. As a household member, I want to see members, share the join code, leave, and (as admin) kick or hand over admin, so that I can run the household from the phone.
9. As a reader with no household, I want to create or join one, so that I can start sharing.
10. As a reader, I want to add and delete site tokens, add, disable, enable and delete API keys, and see a new API key once to copy it, so that imports and integrations keep working.
11. As a reader, I want to copy, revoke, reactivate and delete my recipe share links, so that I control what is public.
12. As a reader, I want to change server, open support, and see the app and server versions, so that I can report a bug with both.
13. As a reader, I want sign out and change server to warn me only when unsynced changes would be lost, so that a plain sign-out is one tap.
14. As an Offline reader, I want Settings readable but its changes disabled with the reason shown, so that I never think a change was saved.

## Implementation Decisions

- **Entry.** The `(tabs)/settings.tsx` tab goes; Settings is a pushed route opened by the avatar menu's existing "All settings" (`apps/mobile/src/components/account-menu.tsx`), with a back button and a small centred nav title like every sub-page.
- **Root sections.** Profile card (name, email, avatar; rows Profile, Preferences, Allergies) · Household · Connections (Site tokens, API keys, Share links) · App (Server, Support, Version) · Sign out.
- **App rows.** Server opens the existing server-address flow (`update-server.tsx` / Connect). Support opens the GitHub issues page in the browser. Version shows the app version and build and the server's version (`config` health `version`), e.g. "1.0 (12) · Server 0.28.0".
- **Sign out and change server** confirm only when the Outbox holds unsynced changes, with the existing "Discard unsynced changes?" alert; otherwise they act at once. Change server signs out, then opens the server address pre-filled.
- **Lists.** Rows have small swipe actions (34 pt circles, 11 pt labels, row content shrinks with an ellipsis) and a long-press menu (lifted row, glass menu with icons, plain scrim). No ⋯ buttons. Delete and Kick red, Revoke and Disable yellow (`--shop`), Reactivate, Enable and Make admin green. One shared settings-row component covers every list; long-press goes through the `native-menu` module.
- **Forms.** Profile and Allergies have Save buttons. Helper text sits behind an (i) hint button (`hint-button.tsx`), never under a field. Sheets follow the Panels kit (glass, no solid footer).
- **Data.** Every read and write uses the shared-react hooks web uses (`@norish/shared-react/reader`: `useProfile`, `useAccountMutations`, `useAllergies`, `useDevicePreference`, `useHousehold`, `useHouseholdMutations`, `useSiteAuthTokens`; share links from the recipes domain). Mobile adds only UI. A missing hook is added to shared-react, never `useTRPC` in the app.
- **Avatar.** Picked with the existing `use-photo-picker` / photo source sheet and uploaded as an `expo-file-system` `File`, the path the recipe editor uses.
- **Sign-in methods.** Link opens the same system auth session the app's OIDC sign-in uses; unlink by swipe or long-press. The last method cannot be removed (as web).
- **Delete account** mirrors web's danger zone, including its note for household admins, behind a destructive confirm.
- **Offline.** Settings shows cached data; every save, swipe action and menu action is disabled, and the glass "Offline" capsule says why. Settings writes that carry a secret (a site token value, a join code, a new API key or share link) never enter the Outbox; the list is `packages/shared-react/src/offline/uncaptured.ts`. (Changed 2026-11-24: it said no Settings write enters the Outbox.)

## Testing Decisions

- Logic that decides a state (which confirm shows on sign-out, row actions per member role and per token or link state, last-sign-in-method guard, offline disabling) lives in plain modules with unit tests.
- Any shared-react hook added gets a test next to the existing ones in `packages/shared-react/src/reader/__tests__`.
- Maestro flows run once after the whole ticket set: open Settings from the avatar menu, edit name, swipe-revoke a token, create and copy an API key, sign out with nothing unsynced. A device check in light and dark.

## Out of Scope

- Admin settings, ingredient management, archive import and export.
- Everything calendar: CalDAV and Apple Calendar Sync on mobile get their own spec.
- A privacy policy page, TestFlight submission, App Review, a reviewer server, the public demo instance.
- Web settings layout changes.
- iPad and foldable layouts.
