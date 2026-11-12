# 33: `features/auth` on web

**What to build:** Web's sign-in screens move from `app/(auth)/` into `features/auth`, as mobile's already are, and route files keep only the server work. After this ticket the whole E2E suite runs. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Auth and the import move".

**Blocked by:** 30, 32

**Status:** ready-for-agent

- [x] `features/auth` holds the login, signup and auth-error screens and their components (`login-client`, `email-password-form`, `provider-button`, `auto-sign-in`, `signup-client`, `signup-form`, `auth-alert`, `auth-card`, `auth-frame`, `auth-marks`).
- [x] `app/(auth)/` keeps the layout, the `loading.tsx` files and each page's server work (the providers read, the auto-redirect decision), rendering the feature's screens.
- [x] `components/auth/provider-icon.tsx` stays, since account draws it too.
- [x] Moved tests run against the new homes; the lint rule's feature boundaries hold with no new exceptions.
- [x] CONTRIBUTING.md's "Project Structure" and the Architecture page list `features/auth` and `components/imports/`, and drop `imports` as a feature (Terra's docs pass).
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
- [ ] The whole E2E suite (`ai`, `offline`, `realtime`) passes once, with no retries, and `base-path` on a `/norish` build; Maestro's sign-in and sign-out flows pass on iOS.

## Comments

- 2026-11-12 (implementer): screens follow the other features' naming: `login-client`/`signup-client` became `login-screen`/`signup-screen` (`LoginScreen`, `SignupScreen`), and auth-error's client body became `auth-error-screen.tsx` with a three-line `page.tsx`. Components sit in `features/auth/components/`.
- `components/skeleton/login-skeleton.tsx` moved into `features/auth/components/` too, since it draws `AuthCard` and shared code may not import a feature; the two `loading.tsx` import it directly. Both auth tests moved to `features/auth/__tests__/`.
- Open demo-instance ticket 02 named the old form path, so it now points at the new one (separate commit). Old tickets marked resolved keep their history.
- Gates green, plus the auth E2E specs (ai: sign-in-methods, auth-gate, page-transitions, 16/16; offline: session-expiry, 1/1). Not done here: the docs box (Terra) and the full E2E/base-path/Maestro box (gatekeeper).

### Review (Opus high, standards + spec) and dispositions

The spec review compared every moved file with `153668651`: a faithful move, no behaviour difference, nothing broken outside it.

1. **fix**: the route decides the auto-redirect and `login-screen.tsx` works the same thing out again. The route hands the screen the one provider to sign in with.
2. **fix**: `login-skeleton.tsx` also holds `SignupSkeleton`, mixing a default and a named export; comments in the moved files that describe rather than name the mechanism, and two over the two-line limit; two `log.debug` calls in a row in `auth-error-screen.tsx`; two lint warnings in `provider-button.tsx`.
3. **fix**: `components/shared/auth-language-selector.tsx` exports one function both named and default, and its two consumers import it differently; `__tests__/app/auth/signed-in-layout.test.tsx` tests the `(app)` layout from a folder that now reads like the feature's.
4. **reject**: resolved tickets in other `.scratch` features naming `app/(auth)/…`. They are a record of what was done then.

Fix round (`b68bf67ea..9b546dd56`): 1-3 fixed. The login route passes `autoSignInProvider`; `signup-skeleton.tsx` is its own file; `signed-in-layout.test.tsx` sits in `__tests__/app/`. Docs: `aaf3e75d5`. Gates green on that state; the auth-touching `ai` specs 16/16. The last checkbox waits on the closing sweep and the final pass.

### Closing sweep and final pass

Closing sweep (`60325ffcd..a82837d57`, docs `81c487ddf`), from a read-only audit of what the by-type layout left: web's unused `lib/logger.ts` deleted; `ai-button` and `data-table` into `features/admin`, `info-hint` into `features/account`, `carousel` into `features/recipes`; `hooks/user/` flattened; five tests moved home; 94 unused shared-react index re-exports and 5 dead web exports removed, 64 file-local exports un-exported; 42 unused message keys removed from all 18 locales. Kept, as the spec sets: `components/imports/`, today's meals in `components/dashboard/today/`, the shell's own pieces.

Final review, GPT-6.1 Sol (xhigh), whole branch:

1. **fix** (bug): on mobile, when auth's own session read answers 401 or no session before any tRPC 401, the app reads signed out and unmounts the signed-in shell with the expiry handler, so the reader reaches sign-in with the Offline Cache uncleared. A session that ends outside a sequence runs Session Expiry.
2. **fix** (bug): a retired mobile auth client's in-flight session read can finish after the wipe and write the old cookie and session back. A client's storage writes are dropped once it is retired.
3. **fix** (docs, Terra): the user docs do not mention the Offline sign-out message or an expired session clearing offline data; a line where the docs describe offline use, if a page does.

Final review, Fable high, spec axis (the xhigh run hit the API rate limit; re-run at high):

4. **fix** (bug): mobile's `endSession` bounds the remote call but then awaits `closeMobileTrpcConnections()`, which waits on a socket mid-reconnect, so a stalled server still holds the tap and an expiry.
5. **fix** (bug): on mobile a request of the previous session answered 401 after the reader signed in again runs the new shell's expiry. A retired tRPC client's 401 and 4401 callbacks do nothing.
6. **fix** (bug against the spec's "an expired session clears the device's offline data before the sign-in page"): a full load with a dead session redirects on the server and clears nothing, which is how an expiry is usually met. Arriving at sign-in with a `callbackUrl` forgets the Offline Cache and keeps the Outbox; the E2E spec gains that path.
7. **fix**: CONTEXT.md says to avoid "Logout" in anything a person reads, and English still labels the menu, the confirm and mobile's alert "Logout" beside the new "Sign out when you're back online." English becomes "Sign out".
8. **fix**: nothing pins web's `onUnauthorized` and `onWebSocketUnauthorized` wiring; a unit test.
9. **fix** (bug, older than the range but in this sequence's path): `user.deleteAccount` is queued like any write, so a delete made Offline shows an error and then replays later. It is never queued.

Final review, Fable high, standards axis:

10. **fix**: hand-written `useCallback`/`useMemo` in files this run moved (`import-from-image-modal`, `import-from-paste-modal`, `carousel`, `use-language-switch`, `use-locale-cookie`).
11. **fix**: names that stopped fitting: `LeaveReason` passed to `endSession` (the deletion ends with "expiry" and leaves with "sign-out"); `use-sign-out.ts` and its generic `once` now hold three sequences; two module-level `left` flags with one name; `setHasActiveSession(false)` beside `publishSignedOut()`.
12. **fix**: dead code the sweep missed: `ThemeSwitch`, five constants in `config/css-tokens.ts`, `SiteConfig`, the test-only `SignOutOptions` re-export, 60 more file-local exports; `components/ui/` holds only `drop-zone.tsx`, used by the image import modal alone; `hidden-items.test.tsx` tests `use-hidden-item-visibility`; `forced-offline.ts`'s 17-line header.
13. **reject**: the confirm flow written in the avatar menu and mobile's smoke screen. The two differ in UI, the smoke screen goes with mobile's rewrite, and sharing needs a new adapter surface (as 30 #12).
14. **reject**: the Offline toast branch in the shared hook, which mobile never reaches. The spec puts a failed `endSession`'s toast in the shared sequence.
15. **reject**: `use-import-recipe` building its own action toast and navigation. 32 was a move; reshaping it belongs with mobile's import screen, which the spec leaves out of scope.
16. **ask**: mobile's tests sit beside their files while CONTRIBUTING.md says tests live in `__tests__/`. Mobile did so before this run; which side changes is Mike's call.

Final fixes: A (`347ade5e9..b2e4f448a`) Sol's 1-2 and 4-9, 11; B (`c3c9be246..b012a1d87`) 10 and 12. `endSession` takes `SessionScope`; `reader/session-end.ts` with `runSessionEnd`; mobile publishes through `publishSignedIn` and `publishSignedOut`. Re-review of A's range (Fable high):

17. **fix** (bug): the clear on arrival at sign-in also runs for a reader who is signed in (Back after signing in, a second tab), wiping their Offline Cache and its owner. The route passes `sessionEnded` only when the request carries no session.
18. **fix**: with one OAuth provider the auto sign-in starts in the same flush as the clear and can navigate away before it lands. The clear finishes first.
19. **fix** (bug): mobile's per-client storage wrapper no longer shares the plugin's write queue with `readPersistedSession()`, so a read torn by a chunked cookie write answers null, which reads as an expiry and wipes the device.
20. **fix**: tests: the server-redirect E2E can pass through a cached document; no StrictMode case for the retired-client flag and no 4401 case; nothing shows a non-401 error or a pending re-read leaving a signed-in session alone. `session-end.ts:97`'s "Mount once in the signed-in shell" is stale.
21. **reject**: the first E2E test no longer telling the in-app clear from the clear at sign-in. In a browser both end on the same page; the unit tests in `reader/` pin the in-app clear.
