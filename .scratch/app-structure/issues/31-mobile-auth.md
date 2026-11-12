# 31: Mobile auth takes web's shape

**What to build:** Mobile's `AuthContext` goes for two hooks and a small `AuthProviders` that hands the session to the platform adapter, as web's does, and signing out on mobile no longer flips back to signed in. See `.scratch/app-structure/spec.md`, "Auth and the import move".

**Blocked by:** 30

**Status:** ready-for-agent

- [ ] A regression test first: sign out with better-auth's session store still holding the user; the app never reads signed-in again and ends on `(auth)`. It fails against the code before 30's order change; if 30 already turned it green, record that in Comments.
- [ ] `useAuthClient()` in `lib/auth/`: the client for the backend URL, reread after each reset (the `useSyncExternalStore` already in `auth-context.tsx`).
- [ ] `useMobileSession()` in `lib/auth/`: the live session, falling back on the persisted one while Offline, pending or on a non-401 error; a 401 means signed out.
- [ ] A small `AuthProviders` hands `useMobileSession()` to the platform adapter with 30's `endSession` and `leave`. `RootStack`, `DomainProviders` and `AuthenticatedProviders` read `usePlatform().session`.
- [ ] `AuthContext`, `useAuth`, the signed-out override, `justLoggedOut`, `consumeLogoutFlag` and sign-out's writes to the persisted user go. The login and register screens take the client from `useAuthClient()` and the backend URL from where `AuthProvider` got it; `login-screen.tsx`'s unused `justLoggedOut` and `justLoggedOutFromQuery` go.
- [ ] The session-invalidation handler and `setHasActiveSession` keep working: the `TrpcProvider` re-key stays as mobile's reload.
- [ ] A Maestro `sign-out.yaml` beside `subflows/sign-in.yaml`: sign in, sign out, land on sign-in, sign in again. It and the existing flows pass on iOS.
- [ ] Gates green: mobile's lint, typecheck, test and `expo export --platform ios`, plus `pnpm lint`, `pnpm typecheck`, `pnpm deps:cycles`.

## Comments
