# 30: One Sign-out

**What to build:** Both apps sign out through one `useSignOut` in `shared-react/reader`: end the session, then clear the Offline Cache, then leave. Web says why when it can't sign out while Offline, and its Session Expiry clears the Offline Cache and keeps the Outbox, as mobile's does. See `.scratch/app-structure/spec.md`, "Auth and the import move", and CONTEXT.md's Sign-out and Session Expiry.

**Blocked by:** 29

**Status:** ready-for-agent

- [ ] Two E2E specs written first, in the `offline` project:
  - an expired session (the server closes the socket with 4401) clears the Offline Cache and keeps a queued change, which replays once the same reader signs in again: red against today's code;
  - signing out while Offline leaves the reader signed in and shows the message: red until the toast lands.
- [ ] `useSignOut(options?)` in `shared-react/reader` runs `endSession()`, then `offlineEngine.clearForSignOut({ discardQueue })`, then `leave()`. A failed `endSession` clears nothing and shows the platform toast; a failed clear is logged and the reader still leaves. `accountDeleted` skips `endSession` and discards, as today.
- [ ] The platform adapter carries `endSession` and `leave` in place of `signOut`:
  - web: `endSession` is better-auth's `signOut` and reports failure; `leave` is the full reload to `/login?logout=true`. `apps/web/lib/auth/sign-out.ts` goes.
  - mobile: `endSession` is a best-effort server call, then closing the tRPC connections and `resetAuthClientStorage()`, so it always succeeds; `leave` is a no-op, since the re-key and the guard take the reader to `(auth)`. `clearSession` in `lib/auth/sign-out.ts` goes.
- [ ] Every caller uses `useSignOut`: the avatar menu and its confirm modal, the danger zone, mobile's smoke screen and mobile's session-invalidation handler.
- [ ] Web's Session Expiry: the 4401 close in `app/providers/trpc-provider.tsx` and a new HTTP 401 handler (`onUnauthorized`, as mobile's) clear the Offline Cache with the queue kept, then go to `/login?callbackUrl=…` as today. One expiry at a time, as mobile's `invalidateSession` dedupes.
- [ ] The Offline message is terse and translated in every locale web's root layout ships ("You're offline. Sign out when you're back online.").
- [ ] Unit tests of `useSignOut`'s order: `endSession` before the clear, a failed `endSession` clears nothing, the queue is discarded only on `discardQueue` or `accountDeleted`.
- [ ] `offline.e2e.ts`'s sign-out tests stay green. Each new test passes `--repeat-each`.
- [ ] Release notes: the Offline sign-out message and an expired session clearing offline data.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
