## Context

The mobile app's auth screens were refactored in the `login-screen-overhaul` change to introduce `AuthShell`, provider icons, and `Stack.Protected`-based routing. That change left several structural issues in the working tree:

- `trpc-provider.tsx` uses `createTRPCProviderBundle<any>`, so `useTRPC()` returns an untyped client. Every call site must cast `(trpc as any)` to call router procedures, losing all type safety.
- `login.tsx` (355 lines) contains inline logic for: auth provider fetching, OAuth sign-in, credential sign-in, redirect sanitization, and auto-redirect. It has grown beyond single-responsibility.
- The connect screen's `useEffect` that loads the stored backend URL and handles redirect-vs-prefill is a self-contained async state machine that belongs in a named hook.
- `auth-shell.tsx` sits in `components/auth/` but it is a layout shell, not an auth-specific widget — `components/shell/` is the correct home.
- Pure utility functions (`sanitizeRedirectTarget`, `firstParam`, `toProviderType`) live inline in screen files instead of a `util/` folder.
- Inline `StyleSheet.create` colours compete with the loaded Tailwind/NativeWind setup; there is no consistent rule about when to use which.
- `*.styles.ts` files for home components live scattered under `components/home/`; a single `src/styles/` directory was started but not completed.

## Goals / Non-Goals

**Goals:**

- Full tRPC type inference in mobile — `useTRPC()` returns `AppRouter`-typed client, no `any` casts at call sites.
- Hook layer for auth tRPC calls mirroring the web `hooks/<domain>/` convention.
- `useBackendUrl` hook encapsulating connect-screen startup logic.
- `login.tsx` split into focused sub-components (`CredentialForm`, `OAuthProviderList`, loading/error states).
- `auth-shell` relocated to `components/shell/`.
- Auto-redirect for single OAuth provider removed from login behaviour.
- Utility functions moved to `src/util/`.
- Styles consolidated: Tailwind `className` where NativeWind supports it; remaining native-only styles in `*.styles.ts` under `src/styles/`.

**Non-Goals:**

- Changes to the web app (read-only reference).
- Changes to `@norish/api` router or procedures.
- Any new auth features or UX flows.
- Animation changes (handled separately).

## Decisions

### 1. Type `createTRPCProviderBundle` with `AppRouter` from `@norish/api/trpc`

**Decision**: Change `trpc-provider.tsx` to `createTRPCProviderBundle<AppRouter>` importing `type AppRouter` from `@norish/api/trpc`.

**Rationale**: The web app does exactly this (`apps/web/app/providers/trpc-provider.tsx`). `@norish/api` is already a workspace dependency of the mobile app (via tRPC integration). Importing a `type` from `@norish/api/trpc` is a type-only import — zero runtime cost and no bundle impact on mobile.

**Alternative considered**: Keep `<any>` and add explicit type annotations at each call site. Rejected — this is just moving the `any` around; it doesn't enable router-level type checking.

**Consequence**: After this change, `useTRPC()` returns a typed proxy matching `AppRouter`. The `(trpc as any).config.authProviders.queryOptions(...)` call becomes `trpc.config.authProviders.queryOptions(...)` with full inference.

---

### 2. Hook extraction pattern: mirror web `hooks/<domain>/use-<domain>-<action>.ts`

**Decision**: Create `src/hooks/trpc/login/use-auth-providers-query.ts` for the `config.authProviders` query used on the login screen.

**Rationale**: The web uses `hooks/config/use-recurrence-config-query.ts` et al. — each file owns exactly one query, exposes a named return shape, and imports `useTRPC` locally. This makes the query reusable, testable, and consistent across platforms.

**File**: `src/hooks/trpc/login/use-auth-providers-query.ts`

```ts
export function useAuthProvidersQuery() {
  const trpc = useTRPC();
  const query = useQuery(trpc.config.authProviders.queryOptions(undefined, { staleTime: 30_000 }));
  return {
    providers: query.data?.providers ?? [],
    registrationEnabled: query.data?.registrationEnabled ?? false,
    passwordAuthEnabled: query.data?.passwordAuthEnabled ?? false,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
```

---

### 3. `useBackendUrl` hook for connect-screen startup

**Decision**: Extract the `useEffect` in `(auth)/index.tsx` into `src/hooks/use-backend-url.ts`.

**Rationale**: The effect is a self-contained async state machine with three outcomes (redirect to login, prefill URL, show empty form). Extracting it makes the connect screen a thin presentation layer and makes the logic testable.

**Shape**:

```ts
export function useBackendUrl() {
  const [baseUrl, setBaseUrl] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  // ... the existing useEffect body, unchanged
  return { baseUrl, setBaseUrl, isHydrated };
}
```

---

### 4. Split `LoginForm` into focused sub-components

**Decision**: Break `login.tsx`'s `LoginForm` into:

| Component              | File                                               | Responsibility                  |
| ---------------------- | -------------------------------------------------- | ------------------------------- |
| `ProviderLoadingState` | `components/auth/login/provider-loading-state.tsx` | Loading spinner + text          |
| `ProviderErrorState`   | `components/auth/login/provider-error-state.tsx`   | Error message + retry button    |
| `NoProvidersState`     | `components/auth/login/no-providers-state.tsx`     | Empty provider message          |
| `CredentialForm`       | `components/auth/login/credential-form.tsx`        | Email/password inputs + submit  |
| `OAuthProviderList`    | `components/auth/login/oauth-provider-list.tsx`    | Maps OAuth providers to buttons |
| `BackendMissingState`  | `components/auth/login/backend-missing-state.tsx`  | No-backend-URL fallback         |

`login.tsx` (the screen file) remains but becomes the orchestrator: renders `AuthShell`, passes props down, owns the `LoginForm` sub-component which assembles the pieces.

**Alternative considered**: Keep everything in `login.tsx` with better internal documentation. Rejected — the file is already 355 lines and the sub-concerns are genuinely independent.

---

### 5. `auth-shell` moves to `components/shell/`

**Decision**: `src/components/auth/auth-shell.tsx` → `src/components/shell/auth-shell.tsx`.

**Rationale**: `AuthShell` is a layout wrapper. `components/shell/` already contains `simple-tab-screen.tsx` and `appearance-settings-sheet.tsx`. The `components/auth/` directory should only contain auth-specific widgets (logo, provider icon).

**Barrel update**: Remove `AuthShell` from `components/auth/index.ts`. Consumers import from `@/components/shell/auth-shell` directly (no barrel needed for shell components — they are few and stable).

---

### 6. Remove auto-redirect for single OAuth provider

**Decision**: Delete the `shouldAutoRedirect` computation and the `useEffect` that calls `handleOAuthSignIn` automatically. Remove `autoRedirectStarted` state.

**Rationale**: Auto-redirect bypasses the login screen without any user action. If the OAuth provider requires a browser redirect, users see nothing — just a blank screen that suddenly navigates. The login screen with a single visible button is clearer and more predictable.

**Impact**: Also remove the `isDisabled` condition on OAuth buttons that referenced `shouldAutoRedirect`.

---

### 7. Util folder for pure functions

**Decision**: Create `src/util/auth.ts` for `sanitizeRedirectTarget`, `firstParam`, `toProviderType`. Additional utility files added as needed (e.g. `src/util/url.ts`).

**Rationale**: These are stateless functions with no component/hook dependencies. A `util/` folder is the standard location across both web and mobile.

---

### 8. Styles consolidation

**Decision**:

- Use Tailwind `className` props for colour, spacing, and typography where HeroUI Native / NativeWind supports it (e.g. `className="text-foreground font-semibold"` instead of `style={{ color: foregroundColor, fontWeight: '600' }}`).
- Native-only styles (flex layout, specific pixel values not in the Tailwind scale, border radii) go into `*.styles.ts` files.
- All `*.styles.ts` files move to `src/styles/` (following the already-migrated `index.styles.ts`).

**Constraint**: NativeWind supports a subset of Tailwind; dynamic colour values (from `useThemeColor`) cannot be replaced with static Tailwind classes. Those remain as `style` props or theme-aware Tailwind tokens if defined.

## Risks / Trade-offs

- **AppRouter import adds a compile-time coupling**: If `@norish/api` adds a server-only import that Metro can't tree-shake, it could break the mobile bundle. Mitigation: use `type` import only (`import type { AppRouter }`); types are erased at compile time.
- **Splitting LoginForm adds file overhead**: 6 small files instead of 1 medium file. Trade-off accepted — each file is individually comprehensible and the total line count is lower.
- **Styles migration is partially manual**: Not all colour usages can be replaced with Tailwind; `useThemeColor` calls that produce dynamic values must stay as `style` props. Scope should be limited to clearly static colour uses.
