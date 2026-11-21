# Mobile app catch-up

Status: ready-for-agent

Settled in a `/grilling` session on 2026-11-05. The vocabulary is CONTEXT.md's Connectivity & Offline section (**Offline**, **Live**, **Reachability Deadline**, **Offline Cache**, **Warm Set**, **Cache Warmer**, **Recovery**, **Outbox**, **Queued**, **Replay**, **Parked**, **Conflicted**, **Client-Minted Id**), which today describes only the web client and is amended here to cover both. Target Version: 0.27.0-beta. Tickets are in `issues/`.

## Problem Statement

The iOS app was parked in 0.26 and has fallen far behind the server and the web client. A household member who opens it today cannot sign in: the server no longer accepts the app's sign-in, and the app still carries Expo template branding, a placeholder bundle id and the system font. Its dependencies are frozen at old versions outside the workspace, so nothing tells a contributor when a shared change breaks it, which is how it drifted.

Worse, the app's offline layer can lose a household's work. A change made in the shop without signal is thrown away if the server rejects it, conflicts with another member's edit, or fails twice, and the app says Queued even when it failed to store the change at all. Queued work is not tied to an account, so a second person signing in on the same phone replays the first person's edits. Every reconnect wipes the cached data. The web client solved all of this in its own Outbox, but the two clients share none of that code.

Realtime also breaks on any server that runs under a base path, and the app has no way to tell a self-hoster that their server is too old for it.

## Solution

The app becomes a working client of the current server, back inside the workspace and its gates, so drift turns a PR red instead of going unnoticed. Its lower layers (sign-in, the tRPC provider, realtime and offline) are kept and fixed; its old tab screens are deleted ahead of a full redesign. Only the sign-in flow and one plain smoke screen remain until the redesigned screens land.

A user enters their server's address, the app checks the server is new enough, and they sign in with a password, Google, GitHub or their household's OIDC provider. The app carries Norish's own name, icon, splash and fonts. Offline, it behaves exactly like the web client, because it runs the same engine: changes are Queued durably per account, replayed in order, Parked with a reason instead of dropped, and Conflicted when another member got there first. Signing out with unsynced work asks first. Realtime works under a base path.

The server re-accepts the app's sign-in safely: the app's own scheme is trusted in code, the Expo development scheme only in development, and the WebSocket origin check can never be tricked into trusting `Origin: null`. The server reports its version, so an app talking to an older server says so and stops instead of failing in odd ways.

## User Stories

1. As a household member, I want to enter my server's address in the app, so that it connects to my own Norish instance.
2. As a household member, I want the app to tell me plainly when the address I entered is not a reachable Norish server, so that I can fix a typo.
3. As a household member, I want the app to tell me my server needs updating when it is older than the app supports, so that I know why I cannot sign in.
4. As a household member, I want that message to name the minimum server version, so that I can pass it to whoever runs the server.
5. As a household member, I want to sign in with my email and password, so that I can use the account I already have.
6. As a household member, I want to sign in with Google or GitHub when my server enables them, so that I don't need another password.
7. As a household member, I want to sign in with my household's OIDC provider, so that the app uses the same login as the web.
8. As a household member, I want the sign-in to happen in the system's secure sign-in sheet, so that my credentials never pass through the app.
9. As a household member, I want to register a new account from the app when my server allows sign-ups, so that I can start on my phone.
10. As a household member, I want my session to survive closing and reopening the app, so that I don't sign in every time.
11. As a household member, I want my session stored in the device's secure storage, so that another app cannot read it.
12. As a household member, I want to see the app under Norish's own name, icon and splash screen, so that I can find it and trust it.
13. As a household member, I want the app to use Norish's typefaces, so that it reads like the web client.
14. As a household member, I want the app to work on my iPhone, so that I can use Norish away from my computer.
15. As a household member, I want my grocery check-offs made without signal to be kept and sent when I reconnect, so that the list stays true after the shop.
16. As a household member, I want a change the server rejects to stay visible with a reason, so that it is never silently lost.
17. As a household member, I want to retry or discard a Parked change myself, so that I decide what happens to it.
18. As a household member, I want to be told when another member changed the same thing first, so that I can reapply mine by hand.
19. As a household member, I want edits to something I created offline to wait for that create, so that they land on the right recipe or item.
20. As a household member, I want my queued changes replayed in the order I made them, so that the final state is what I intended.
21. As a household member, I want the app to fail a change openly when it cannot store it in the Outbox, so that a change shown as Queued is really kept.
22. As a household member, I want my cached recipes and groceries to stay on screen while the app refreshes after reconnecting, so that the screen doesn't blank.
23. As a household member, I want my most recent recipes, groceries, stores, cookbooks and this week's plan available offline, so that I can cook and shop without signal.
24. As a household member, I want a recipe I just created to be available offline at once, so that I can cook it straight away.
25. As a household member, I want the app to give up waiting for an unresponsive server after a bounded time and show me what it has cached, so that a hanging network never freezes it.
26. As a household member, I want the app to notice the server came back without my doing anything, so that queued work goes out on its own.
27. As a household member, I want to see when the app is Offline and when it is syncing, so that I know whether my changes have reached the household.
28. As a household member sharing a phone, I want queued work and cached data scoped to the signed-in account, so that the next person never replays or sees mine.
29. As a household member, I want the app to ask before I sign out with unsynced work, so that I don't throw it away by accident.
30. As a household member whose queued work belongs to a signed-out account, I want it replayed only when that account signs in again, so that it is never sent as someone else.
31. As a household member, I want a photo I attach offline to be queued like any other change, so that it uploads when I reconnect.
32. As a household member, I want realtime updates from other members while the app is open, so that the list changes as they shop.
33. As a self-hoster running Norish under a base path, I want the app's realtime connection to use that path, so that live updates work on my setup.
34. As a self-hoster, I want the server to accept the official app's sign-in without extra configuration, so that my household can just install it.
35. As a self-hoster, I want the Expo development scheme trusted only on a development server, so that my production server does not accept arbitrary Expo projects.
36. As a self-hoster, I want the app's scheme kept out of the configurable trusted-origins list, so that a misconfiguration cannot make the WebSocket trust `Origin: null`.
37. As a self-hoster, I want the server's version shown in its readiness response, so that the app and my monitoring can read it.
38. As a self-hoster, I want the server on a Better Auth line that has closed the Expo authorization-proxy open redirect, so that re-enabling the app adds no known hole.
39. As a contributor, I want the mobile app inside the pnpm workspace on the shared catalog versions, so that it installs and upgrades with everything else.
40. As a contributor, I want `pnpm typecheck`, `pnpm lint` and `pnpm test:run` to cover the mobile app, so that a shared change that breaks it fails CI.
41. As a contributor, I want one offline engine shared by web and mobile, so that a fix lands for both clients at once.
42. As a contributor, I want each client to supply only a storage adapter to that engine, so that the platform-specific part stays small.
43. As a contributor, I want a single contract suite that every storage adapter must pass, so that a new adapter cannot quietly behave differently.
44. As a contributor, I want the web offline E2E project to keep passing unchanged through the extraction, so that moving the engine is proven not to change web behaviour.
45. As a contributor, I want Maestro flows for sign-in, the smoke screen, a grocery check-off, an offline write that replays, and the update-your-server screen, so that "works with the server" is a test, not a claim.
46. As a contributor, I want the app version to follow the release version, so that the app and its minimum server version are easy to reason about.
47. As a contributor, I want the repo guidance to stop calling the app parked, so that the next agent or contributor treats it as maintained.
48. As a maintainer, I want the catch-up as one PR with one commit per ticket, so that each step can be reviewed and bisected on its own.
49. As a maintainer, I want the release notes to list only the server-visible changes, so that nobody looks for an app that is not distributed yet.

## Implementation Decisions

### App identity

- The bundle id becomes `dev.norish.app` and the URL scheme `norish`; the slug and display name follow. `supportsTablet` stays off: the app is built for iPhone first, and iPad runs it in iPhone compatibility mode until the iPad and foldable pass turns it on.
- The icon, adaptive colours and splash come from the brand set the web ships, on the paper ground with the green accent. The Expo template assets are deleted.
- Inter, Fraunces and Fira Code are loaded, so the shared theme's font tokens resolve. Colours and radii already come from the shared HeroUI theme file and need no change.
- The faked-glass views are removed for now. The redesign brings back real Liquid Glass per Apple's 2026 guidelines; ADR-0020's ban on faked glass is about the web, and the redesign records the mobile exception.

### Workspace and dependencies

- The app rejoins the pnpm workspace. Its dependencies go back to `catalog:` and `workspace:*`, its own lockfile is deleted, and the root `dev:mobile` script goes back to a workspace filter.
- Expo moves from SDK 56 to SDK 58 (npm's `latest` tag, 58.0.23 on 2026-11-03), with React Native and React at the versions SDK 58 pins.
- The app gains `typecheck`, `lint` and `test` scripts, so Turborepo's existing tasks reach it with no root config change. The version-sync script stops treating it as independent.
- Rejoining brings the Expo advisory cluster back into a manual `pnpm audit`. No CI gate runs the audit, so this is accepted.

### Screens

- Every tab screen is deleted. The sign-in flow stays (server address, login, register, the sign-in callback and error screens), plus a new "update your server" screen.
- One plain smoke screen sits behind sign-in: the signed-in user, a recipe count and one grocery list with a checkbox. It exists so the plumbing can be driven by hand and by Maestro, and it is deleted when the redesigned screens land.
- Mobile-only copies of shared logic that belong to deleted screens go with them. Logic that survives moves into `@norish/shared` when its screen is rewritten, not in this catch-up.

### Folder structure

- The app is laid out by feature, after bulletproof-react. `src/app/` holds only Expo Router route files, each a few lines that render a screen from a feature. `src/features/<feature>/` holds that feature's screens, components and hooks; a feature adds only the subfolders it needs.
- Code used by two or more features lives in shared folders: `src/components/`, `src/hooks/` and `src/lib/` (platform glue such as storage, i18n, the tRPC provider and the offline storage adapter).
- Imports run one way: shared folders, then features, then `src/app/`. A feature never imports another feature; routes compose them. A `no-restricted-imports` override in the app's ESLint config enforces it.
- Domain logic shared with web stays in `@norish/shared` and `@norish/shared-react`; a feature holds only what is mobile-only.
- Tests sit next to the code as `*.test.ts(x)`, not under `__tests__/`, which the shared ESLint config ignores.
- The catch-up starts it with `features/auth` and `features/smoke`. Web moves to the same layout through `.scratch/app-structure/spec.md`.

### Server sign-in

- `better-auth`, `@better-auth/core` and `@better-auth/expo` move to 1.7.17 in the catalog now. The release-age wait is deliberately skipped for this upgrade. 1.7.16 is the first release whose Expo authorization proxy only redirects to a configured provider's origin and only for a state it issued.
- The auth module mounts the Expo server plugin again.
- `norish://` is a hard-coded entry in Better Auth's trusted origins, never added through the `TRUSTED_ORIGINS` environment list. `exp://` is trusted only in development, which the plugin already enforces.
- The WebSocket origin check rejects the opaque `"null"` origin outright, whatever the configured lists contain.
- Accepted risk: a malicious app can start its own sign-in claiming the `norish` scheme. The server still requires a real sign-in, and iOS names the requesting app in its sign-in prompt, so this is phishing, not an auth bypass. iOS's secure sign-in sheet hands the callback only to the app that opened it, so interception is not possible on iOS. Android is out of scope until the session cookie in the callback is replaced by an app-bound code exchange.

### Realtime

- The app builds its WebSocket URL from the server address including its base path, matching where the server listens, instead of a hard-coded root path.
- The stale reconnect-invalidation option the app passes to the shared providers is removed.

### Shared offline engine

- Web's offline client moves into `@norish/shared-react` as one engine: the Outbox model and its admission guarantee, Replay with error classification, parking of dependants, conflict detection, the replay leader lock, Recovery, the Cache Warmer and Warm Set, the connectivity probe and its state machine, and the per-owner Offline Cache persister.
- Its public interface takes a **storage adapter** and the client's tRPC replay transport, and returns the outbox link, the persister, the connectivity state and the status actions (sync now, retry, discard) the UI needs. Platform-only concerns stay outside it: the web service worker and App Shell, the forced-Offline toggle wiring, and the mobile device-network signal, which only prompts an earlier probe.
- The storage adapter covers durable Outbox entries (per owner, with status, parked reason, operation id and Client-Minted Id), the persisted Offline Cache (per owner), and blob payloads for uploads.
- Web supplies the IndexedDB adapter its code uses today. Mobile supplies an MMKV adapter, storing upload files as copies in the app's own storage referenced by path.
- Mobile behaviour converges on web's in every respect the offline audit listed:
  - first-in-first-out Replay that halts on unreachable or unauthorized
  - parking, never dropping
  - the Conflicted outcome
  - dependants parked with their create
  - owner-scoped cache and Outbox, plus the sign-out prompt
  - a failed admission fails the mutation
  - refetching without clearing on Recovery
  - the readiness endpoint as the probe target, probed on the shared schedule
  - the 7-day cache age
- Mobile's own outbox, replay, persister and backend-health probe are deleted. Replay marks requests with one shared header value per client so server logs still tell them apart.
- CONTEXT.md's Connectivity & Offline terms are reworded from "the web client" to "a client". ADR-0001 is amended to say the engine is shared and storage is per client. No new ADR.

### Server version and the version gate

- The readiness response (`/health/ready`, and the deprecated `/health`, which mirrors it) gains a `version` field carrying the running server version. The OpenAPI document describes it. Exposing it publicly is accepted, since the image tag already reveals it.
- The app requires a minimum server version: the current release's minor. The server-address step reads the version from its existing probe and shows the "update your server" screen below the minimum, without attempting sign-in.
- The app version follows the release version through the existing version-sync tooling.

### Delivery

- One PR to the 0.27.0-beta release candidate, one commit per ticket.
- The release notes cover only what changes on the server: the app's sign-in is accepted again, and the readiness response reports the version. The app is not announced until it reaches TestFlight.
- The repo guidance (AGENTS.md, CONTRIBUTING) drops the "parked" wording and the separate install step.

## Testing Decisions

- A good test drives a module through its public interface and asserts what a user or caller would observe: what the server accepts, what was replayed, what is Parked and why, what the screen shows. It never asserts internal calls or storage layout.
- **Shared offline engine.** Web's existing outbox and connectivity vitest suite (replay, outbox store, error classification, recovery, leader, input codec, status actions, outbox link, probe, connectivity machine, forced offline) moves with the engine and runs against the engine's public interface.
- **Storage adapters.** One adapter contract suite runs identical cases against the IndexedDB adapter and the MMKV adapter: owner scoping, ordering, status transitions, blob round-trips, and purge on account switch.
- **Web regression.** The web offline E2E project runs unchanged and must stay green through the extraction. It is the proof that web behaviour did not move.
- **Server sign-in.** The existing `packages/auth` suite gains cases for:
  - a sign-in carrying a `norish://` Expo origin is accepted
  - any other custom scheme is rejected
  - `exp://` is rejected outside development

  The existing tRPC WebSocket server suite gains a case that the origin check never trusts `"null"`, even when the configured trusted list contains a custom scheme.
- **Server version.** The existing health procedure tests assert that `version` is present on `/health/ready` and `/health`.
- **Mobile app.** Maestro flows run locally on the iOS simulator against the dev server:
  - sign in through the server-address screen
  - the smoke screen loads the user, recipe count and a grocery list
  - check off a grocery
  - make a write while Offline and see it replay on reconnect
  - an older server shows the "update your server" screen

  The minimum-version comparison has no separate unit test; the Maestro flow covers it.
- **Existing mobile vitest files.** The 23 files are trimmed to those testing surviving code. Tests for mobile's deleted outbox, replay and query-cache code go with that code.
- **Flaky tests.** Every new test is checked with repeated runs, and a test that only passes on re-run is a bug to fix, not to retry.

## Out of Scope

- iPad and foldable iPhone layouts (regular width). They follow the iPhone redesign, as their own pass, and that pass turns `supportsTablet` on.
- Redesigned screens: library and recipe detail with cook mode, groceries, calendar, recipe edit and create, import, household and user settings. They follow this catch-up, from the design track below.
- Admin settings in the app.
- Android, which first needs an app-bound code exchange to replace the session cookie in the sign-in callback.
- The TestFlight and App Store pipeline (EAS Build and Submit is the likely choice) and Maestro on a macOS CI runner.
- On-device AI (Apple Foundation Models for import and photo parsing), which needs its own ADR because it would sit outside the AI runtime boundary.
- App Attest, deliberately skipped, since sideloaded and self-built apps would fail it.
- An opt-in server toggle for mobile sign-in.
- Capability detection per feature; the app relies on the minimum server version alone.
- Widgets, Live Activities beyond the existing timer activity, share-sheet import and offline photo import UI. Each comes with its redesigned area.

## Further Notes

- **Design track, in parallel.** The redesign is designed in claude.ai Design canvas sessions while the catch-up is built. The style is iOS-native with Norish's shared tokens, following Apple's 2026 Liquid Glass guidelines.
  - iPhone first. Every area is designed and built at *compact* width (iPhone: bottom tab bar, single column, sheets) before any larger layout.
  - Then the foldable iPhone and iPad, as a second pass over the finished areas at *regular* width (unfolded iPhone, iPad, wide window: sidebar and split views, sign-in as a centred card). Layouts stay keyed to width class, not device, so the folded iPhone already gets the compact layout for free.
  - iPhone order:
    1. Sign-in: server address, login, register, update-your-server.
    2. Library and recipe detail with cook mode.
    3. Groceries.
    4. Calendar.
    5. Recipe edit.
    6. Import, household and settings.
- **Why the app was parked.** 0.26 parked it mainly to cut audit noise: 84 of 181 advisories came through the Expo packages' optional peers. The Expo plugin was removed from the server at the same time because nothing used it. Re-adding both is expected and not a regression.
- **Ticket order.**
  1. App identity.
  2. Rejoin the workspace on Expo 58.
  3. Delete the old screens and add the smoke screen. Tickets 2 and 3 land together so the gates stay green.
  4. Server sign-in.
  5. Realtime base path.
  6. Shared offline engine. The extraction lands first with web unchanged, then the mobile adapter.
  7. Server version and the version gate.
  8. Maestro flows.
  9. Docs and release notes.
