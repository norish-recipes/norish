# 31: Mobile auth takes web's shape

**What to build:** Mobile's `AuthContext` goes for two hooks and a small `AuthProviders` that hands the session to the platform adapter, as web's does, and signing out on mobile no longer flips back to signed in. See `.scratch/app-structure/spec.md`, "Auth and the import move".

**Blocked by:** 30

**Status:** done

- [x] A regression test first: sign out with better-auth's session store still holding the user; the app never reads signed-in again and ends on `(auth)`. It fails against the code before 30's order change; if 30 already turned it green, record that in Comments.
- [x] `useAuthClient()` in `lib/auth/`: the client for the backend URL, reread after each reset (the `useSyncExternalStore` already in `auth-context.tsx`).
- [x] `useMobileSession()` in `lib/auth/`: the live session, falling back on the persisted one while Offline, pending or on a non-401 error; a 401 means signed out.
- [x] A small `AuthProviders` hands `useMobileSession()` to the platform adapter with 30's `endSession` and `leave`. `RootStack`, `DomainProviders` and `AuthenticatedProviders` read `usePlatform().session`.
- [x] `AuthContext`, `useAuth`, the signed-out override, `justLoggedOut`, `consumeLogoutFlag` and sign-out's writes to the persisted user go. The login and register screens take the client from `useAuthClient()` and the backend URL from where `AuthProvider` got it; `login-screen.tsx`'s unused `justLoggedOut` and `justLoggedOutFromQuery` go.
- [x] The session-invalidation handler and `setHasActiveSession` keep working: the `TrpcProvider` re-key stays as mobile's reload.
- [x] A Maestro `sign-out.yaml` beside `subflows/sign-in.yaml`: sign in, sign out, land on sign-in, sign in again. It and the existing flows pass on iOS.
- [x] Gates green: mobile's lint, typecheck, test and `expo export --platform ios`, plus `pnpm lint`, `pnpm typecheck`, `pnpm deps:cycles`.

## Comments

- `useMobileSession` reads the current client's session atom through `useSyncExternalStore`, not better-auth's `useStore`, which shows the previous client's last value for one render after a reset (the expiry path read signed in again). The persisted fallback is keyed by client, so a reset rereads it. Both are the root fixes; reverting either turns `auth-providers.test.tsx` red. The test needs the new seam, so it cannot run against the code before 30. It was written against these hooks and was green on them.
- Maestro's `sign-out.yaml` found a bug: signing in again after sign-out lost typed input. The signed-out route guard mounted the login screen before `clearForSignOut` emptied the cache, so the first keystroke reset the providers query. Mobile's `leave` was a no-op; it now re-keys the tRPC provider (`reloadAuthTransport`), as the spec's "mobile's reload" says.
- Deviations: `RootStack` takes `signedIn` as a prop, since onboarding renders it with no platform. The login and register screens test `useAuthClient() === null` instead of reading a backend URL (the client is null exactly when no URL is set). `MobileIntlProvider` takes `signedIn` because it sits above the platform. Mobile gained `@testing-library/react`, `react-dom` and `jsdom` as devDependencies (react-dom added to `expo.install.exclude`, like react).

### Review (Fable high, standards + spec) and dispositions

1. **fix** (bug): better-auth's client empties its session store when `signOut` is called, before the request, so the guard showed sign-in on the old client while the remote call ran (up to 5 s), `AuthProviders` re-keyed once then and `leave` re-keyed again, dropping anything typed; a sign-in in that window was wiped. While the device ends its session the platform session reads pending, and `leave` publishes signed out with the one re-key. `reloadAuthTransport` goes.
2. **fix** (bug): the login and register screens gate on `useAuthClient() === null`, read synchronously, while the boot gate switches trees after an async reread; straight after the connect screen saves a URL the form can render in the onboarding tree with no tRPC provider. They read the backend URL where the boot gate does, as the ticket says.
3. **fix** (bug): a failed storage wipe leaves the old client current, so an expiry reads signed in after the re-key. The reset replaces the client either way.
4. **fix**: `auth-providers.test.tsx` models the real client (the store emptied at the call), remounts through the re-key and asserts what the guard reads, the platform's session.
5. **fix**: the session's field split is `use-reader.ts`'s; one helper beside `sessionReader`, which also settles the empty-name difference. `PersistedUser` duplicates `SessionUser`.
6. **fix**: `AuthClient` names a nullable type beside `auth-client.ts`'s; `DomainProviders` provides nothing now and its banner is stale; `MobileIntlProvider` only forwards to its inner component; `endSession` takes `null` only to fit a type.
7. **fix**: `sign-out.yaml` repeats `subflows/sign-in.yaml`'s credential steps; its comment and the test's "route guard's signal" comment describe history or the wrong reader.
8. **fix** (docs, Terra): AGENTS.md says only React is excluded from `expo install --check`; `react-dom` is too.
9. **reject**: the regression test not running against the code before 30. The hooks it tests did not exist; the ticket allows recording that.
10. **reject**: the three devDependencies as scope creep. The regression test has to render `AuthProviders`; they are declared as web and shared-react declare them.

Fix round 1 (`824915099..068081d2b`): 1-7 fixed; the login-form throw (2) was real. The boot gate's URL reaches `useAuthClient` through `BackendBaseUrlContext`; `leave` is `publishSignedOut`; `useSessionReader` in shared-react; `subflows/credentials.yaml`. Maestro's six flows passed on a fresh Release build. Docs: `b2177d5be` (8). Re-review of the fix range (Fable high):

11. **fix** (regression): `useSessionReader` calls no hook, so the React Compiler skips it and the session changes identity every render, rebuilding the adapter on web and mobile. `"use memo"`, with a test on identity.
12. **fix**: the pending render during a sign-out is a blank screen for up to 5 s. It shows the app's loading indicator.
13. **fix**: `AuthProviders`' `.catch` on `endSession` is unreachable, since mobile's cannot reject (I asked for it; wrong). It and its test go.
14. **fix** (latent bug): deleting the Account leaves without `endSession`, so on mobile the client is not reset and the remount reads signed in. The delete drops the device's session (`endSession("expiry")`) before the clear, as every other path does.
15. **fix**: `clearAuthStorage` is a `Promise.all`, so the client was replaced while the other key's wipe was in flight; `clearBackendBaseUrl` has no caller.
16. **reject**: no unit test pins `leave: publishSignedOut`. `sign-out.yaml` pins it on a device; a unit test needs the native provider tree in jsdom.
17. **reject**: after a wholly failed wipe the new client reads the same stored session. A device that cannot wipe its storage would read it at the next launch whatever the client does.
18. **reject**: `BackendMissingState` flashing after connect before the tree swaps, and the offline engine keying its client by the synchronous store. Both are as before this ticket.

Fix round 2 (`b991d024a..f9bc1991b`): 11-15 fixed. shared-react's tests do not run the React Compiler, so 11 is pinned by a lint rule (a hook that calls no hook opens with `"use memo"`). `dropAndLeave` in `use-sign-out.ts` serves Session Expiry and the Account deletion. Gates green on the final state; Maestro was last run at `068081d2b` and runs again on the final tree after 33.
