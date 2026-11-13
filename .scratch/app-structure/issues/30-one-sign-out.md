# 30: One Sign-out

**What to build:** Both apps sign out through one `useSignOut` in `shared-react/reader`: end the session, then clear the Offline Cache, then leave. Web says why when it can't sign out while Offline, and its Session Expiry clears the Offline Cache and keeps the Outbox, as mobile's does. See `.scratch/app-structure/spec.md`, "Auth and the import move", and CONTEXT.md's Sign-out and Session Expiry.

**Blocked by:** 29

**Status:** done

- [x] Two E2E specs written first, in the `offline` project:
  - an expired session (the server closes the socket with 4401) clears the Offline Cache and keeps a queued change, which replays once the same reader signs in again: red against today's code;
  - signing out while Offline leaves the reader signed in and shows the message: red until the toast lands.
- [x] `useSignOut(options?)` in `shared-react/reader` runs `endSession()`, then `offlineEngine.clearForSignOut({ discardQueue })`, then `leave()`. A failed `endSession` clears nothing and shows the platform toast; a failed clear is logged and the reader still leaves. `accountDeleted` skips `endSession` and discards, as today.
- [x] The platform adapter carries `endSession` and `leave` in place of `signOut`:
  - web: `endSession` is better-auth's `signOut` and reports failure; `leave` is the full reload to `/login?logout=true`. `apps/web/lib/auth/sign-out.ts` goes.
  - mobile: `endSession` is a best-effort server call, then closing the tRPC connections and `resetAuthClientStorage()`, so it always succeeds; `leave` is a no-op, since the re-key and the guard take the reader to `(auth)`. `clearSession` in `lib/auth/sign-out.ts` goes.
- [x] Every caller uses `useSignOut`: the avatar menu and its confirm modal, the danger zone, mobile's smoke screen and mobile's session-invalidation handler.
- [x] Web's Session Expiry: the 4401 close in `app/providers/trpc-provider.tsx` and a new HTTP 401 handler (`onUnauthorized`, as mobile's) clear the Offline Cache with the queue kept, then go to `/login?callbackUrl=…` as today. One expiry at a time, as mobile's `invalidateSession` dedupes.
- [x] The Offline message is terse and translated in every locale web's root layout ships ("You're offline. Sign out when you're back online.").
- [x] Unit tests of `useSignOut`'s order: `endSession` before the clear, a failed `endSession` clears nothing, the queue is discarded only on `discardQueue` or `accountDeleted`.
- [x] `offline.e2e.ts`'s sign-out tests stay green. Each new test passes `--repeat-each`.
- [x] Release notes: the Offline sign-out message and an expired session clearing offline data.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Red first at 48081814c (two new specs): `session-expiry` reached `/login?callbackUrl=%2Fgroceries` but `norish-images` was still kept (`Expected: false, Received: true`); `offline-sign-out` found no message. Green after, 10/10 at `--repeat-each=5`, `offline.e2e.ts` 20/20.
- The adapter also carries `offlineEngine` (`{ clearForSignOut }`): each app owns its engine and `useDeleteAccountMutation` has no other way to reach it. `useSignOut()` returns `signOut(options?)`, since the confirm picks `discardQueue` at call time; `useReader` no longer returns `signOut`.
- Web's expiry is a module-level `expireSession` in `trpc-provider.tsx` (clear keeping the queue, then `/login?callbackUrl=…`, once per page), not `useSignOut`: better-auth's sign-out fails once the cookie is gone. Mobile's invalidation handler registers in `AuthenticatedEffects`, under the platform, with `useSignOut()`.
- Mobile: `clearSession` became `endSession(authClient)` in `lib/auth/end-session.ts`; the context's `endSession` runs it and then sets the signed-out state 31 removes. The web sign-out test's engine case (a failed discard still resets) moved to `engine.test.ts`.
- Left: Release notes, for the docs writer.

### Review (Fable high, standards + spec) and dispositions

1. **fix** (bug): an explicit Sign-out and a Session Expiry can run at once on both apps. The clear empties the query client under a mounted shell, the refetch is answered 401, and the expiry then navigates last (web loses `logout=true`) or resets the cache owner first (the discard discards nothing). Session Expiry moves into `reader/` beside `useSignOut` as one sequence with one in-flight guard; the apps' 401 and 4401 callbacks call it, and it does nothing unless the signed-in shell mounted it. Web's `leave` navigates once.
2. **fix**: web's expiry duplicated the clear, log and leave tail; mobile's ran through `signOut()` though the glossary keeps the two apart. Both go with 1, as do `registerSessionInvalidationHandler`, `invalidateSession` and `SessionInvalidationReason`.
3. **fix**: any failed `endSession` said "You're offline". The Offline message shows only while Offline; another failure goes to the platform's error display.
4. **fix**: mobile's sign-out waits on the server call with no bound, so a stalled connection freezes the tap. The remote call gets a short timeout.
5. **fix**: "one expiry at a time" had no test; unit tests in `reader/` pin the guard in both directions.
6. **fix**: `session-expiry.e2e.ts` asserts the persisted query cache too; `offline-sign-out.e2e.ts` asserts the cache and a queued change survive; one `readOutbox` in the offline fixture replaces three copies.
7. **fix**: the adapter's `offlineEngine` is typed `Pick<OfflineEngine, "clearForSignOut">`; `engine.ts`'s comment on `clearForSignOut` is stale.
8. **fix** (docs, Terra): CONTRIBUTING.md and the Architecture page list what the adapter and `reader/` carry now; ADR offline/0005's line on reads surviving cookie expiry.
9. **reject**: the adapter carrying `offlineEngine` beyond the spec's "only `endSession` and `leave`". Shared hooks have no other way to an app's engine; the spec line is amended instead.
10. **reject**: `auth-context.tsx`'s `useMemo` over a plain `endSession` and the `endSessionOn` alias. Ticket 31 deletes the file; checked there.
11. **reject**: mobile's empty `leave`. The spec sets it: the re-key is mobile's reload.
12. **reject**: the apps reading `unsyncedChanges()` from their own engine. Each app owns its engine, and shared hooks take it as an argument elsewhere.

Fix round 1 (`d230b2844..d785634e5`): 1-7 fixed. `useSessionExpiry` (mounted in web's `ShellSubscriptions` and mobile's `AuthenticatedEffects`) and `expireSession` joined `useSignOut` in `reader/`; `leave(reason)`; web's `leaveToLogin` navigates once.

13. **fix** (bug, raised by the fixer): deleting the Account ends the session on the server before `signOut({ accountDeleted })` runs, so a 401 or 4401 in that window starts a Session Expiry that wins: the Outbox is kept and web lands without `logout=true`. The delete itself becomes the sequence's first step, inside the guard.

Fix round 2 (`c5f25c11b`): 13 fixed, `accountDeleted` gone. Docs: `e636ed3ef` (8). Re-review of `ab3361a9c..c5f25c11b` (Fable high):

14. **fix** (bug, mine: the round-1 design asked for it): a Session Expiry called `endSession`, which on web is better-auth's sign-out, so a 401 or 4401 from a passing server error ended a session that was still valid. `endSession` takes the reason; on expiry web does nothing and mobile only wipes the device.
15. **fix** (bug): mobile's timed-out remote sign-out was abandoned, not aborted; resolving late it emptied the cookie of a reader who had signed in again. The timeout aborts the request.
16. **fix** (bug): a 401 that arrives during a sequence that then fails (deleting the Account on a session already expired) was dropped, leaving the reader on a dead shell. An expiry asked for during a sequence runs once the sequence settles without leaving.
17. **fix**: `showError(error, "sign out")` breaks the `area:action` context convention; `readOutbox` and `persistedReadsHold` share one scaffold, and two more specs open `norish-offline` by hand; a test pins that a re-render keeps the expiry registered.
18. **reject**: the shared guard releasing at `leave` while web's `left` flag stops a second navigation. They guard different things: a sequence (mobile lives on after it) and a page. The late second clear finds no owner and does nothing.
19. **reject**: `isOffline` read at render. The window is the seconds before the probe notices; the reader still gets an error, and a read at failure time needs a new adapter surface.

Fix round 3 (`d3479f6c6..e4111be20`): 14-17 fixed. `endSession(reason)`: on expiry web does nothing and mobile only wipes the device; the remote sign-out is aborted at 5 s; an expiry asked for mid-sequence runs once the sequence settles without leaving; `harness/offline-store.ts` reads the offline IndexedDB for every spec. Gates green on the final state; `session-expiry` and `offline-sign-out` 10/10 at `--repeat-each=5`, `offline.e2e.ts` 20/20.
