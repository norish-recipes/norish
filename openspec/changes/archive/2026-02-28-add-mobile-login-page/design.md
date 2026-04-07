## Context

The mobile app (`apps/mobile`) currently has no authentication gate and immediately redirects users to the recipes tab (`src/app/index.tsx -> /recipes`). In contrast, web and server authentication are already operational through BetterAuth with dynamically configured providers (GitHub, Google, OIDC, optional credential auth) and existing OAuth wiring. This creates a platform inconsistency and leaves mobile routes accessible without identity.

The mobile app already includes Expo Router and deep-link scheme support (`app.json` includes `scheme: "mobile"`), plus `expo-web-browser` and `expo-linking`, which are suitable building blocks for OAuth redirect flows. The environment already includes a backend URL that mobile can use to reach BetterAuth endpoints. The mobile app does not yet have tRPC wiring, so a tRPC foundation capability is required before provider discovery can be consumed from mobile.

## Goals / Non-Goals

**Goals:**

- Introduce a dedicated mobile login screen and unauthenticated route surface.
- Introduce mobile tRPC client/provider wiring as a prerequisite capability.
- Add default route protection so app content requires an authenticated session.
- Reuse existing BetterAuth backend capabilities and configured OAuth/social providers.
- Ensure OAuth sign-in can complete on mobile and route users back into protected screens.
- Keep backend contract changes minimal and aligned with existing auth configuration.

**Non-Goals:**

- Replacing or redesigning server-side BetterAuth configuration.
- Building a full mobile signup/password-reset flow in this change.
- Introducing provider-specific custom auth logic beyond existing BetterAuth behavior.

## Decisions

### 1. Add explicit public vs protected mobile route surfaces

Mobile routing will distinguish unauthenticated and authenticated surfaces:

- Public auth routes (login and auth callback/error handling)
- Protected app routes (existing tabs and app content)

A root auth guard in mobile layout/router logic will check session state before rendering protected routes and redirect to login when session is missing.

**Alternatives considered:**

- Guarding each screen individually. Rejected because it is repetitive and easy to bypass for new routes.

### 2. Add mobile tRPC foundation before auth feature wiring

This change includes a prerequisite capability (`mobile-trpc-foundation`) so mobile can call backend procedures using the same tRPC stack used by web. Provider discovery and future mobile data access should go through the tRPC client/provider abstraction rather than ad-hoc fetch calls.

**Alternatives considered:**

- Deferring tRPC and using direct fetch for login-only APIs. Rejected because it creates a one-off networking path and immediate migration overhead.

### 3. Use backend-driven provider availability for login UI via a public tRPC procedure

The web app currently resolves providers server-side by calling `getAvailableProviders()` directly in `apps/web/app/(auth)/login/page.tsx`. Mobile cannot reuse that server-only import path, so we will expose a public tRPC procedure (proposed path: `config.authProviders`) that returns the same provider payload by reusing existing provider-resolution logic. This keeps provider behavior consistent with web and avoids hardcoded mobile provider lists.

**Alternatives considered:**

- Hardcoded provider buttons in mobile. Rejected because it drifts from server configuration and creates runtime failures when providers are disabled.
- Attempting to reuse web server-component provider lookup directly from mobile. Rejected because mobile cannot call server-only module imports.

### 4. Use BetterAuth-compatible OAuth redirect flow with mobile deep linking

OAuth sign-in will launch an external auth flow and return to app deep links (`mobile://...`) for completion. Callback handling will finalize auth and route users to protected content (or an explicit auth error surface on failure).

**Alternatives considered:**

- Embedding web login in an in-app WebView. Rejected for poorer UX and increased complexity around cookie/session handling.

### 5. Centralize mobile auth client configuration around backend URL env var

A mobile auth client module will be introduced so auth calls (session read, provider sign-in initiation, sign-out) consistently use the configured backend base URL. Missing/invalid backend URL will produce a clear login-screen error state.

**Alternatives considered:**

- Inline URL usage per screen/service. Rejected due to duplication and higher misconfiguration risk.

### 6. Keep login implementation OAuth-first

Given existing usage patterns, login UX will prioritize social/OAuth providers. Password login can remain optional and only displayed when backend configuration enables it.

**Alternatives considered:**

- Credential-only first pass. Rejected because it does not match current deployment usage.

### 7. Support single-provider OAuth auto-redirect with web parity safeguards

When backend configuration yields exactly one OAuth provider and credential auth is disabled, mobile login will auto-start provider sign-in, matching current web behavior. Auto-redirect will be skipped in explicit post-logout flows so users can remain on the login screen intentionally.

**Alternatives considered:**

- Always showing provider selection first. Rejected because single-provider setups add unnecessary friction.

## Risks / Trade-offs

- [Session transport differences between web and mobile] -> Mitigation: isolate session bootstrap in a mobile auth service and validate persistence behavior with simulator/device tests before expanding scope.
- [OAuth callback/deep-link mismatches per platform] -> Mitigation: define and test callback URL conventions for iOS/Android and include explicit error routing.
- [Provider list availability for unauthenticated mobile] -> Mitigation: add a public tRPC `config.authProviders` procedure that reuses `getAvailableProviders` semantics.
- [tRPC foundation not ready when auth work starts] -> Mitigation: implement `mobile-trpc-foundation` tasks first and gate login tasks on that prerequisite.
- [Auth guard regressions causing redirect loops] -> Mitigation: keep guard logic centralized and include explicit loading/unknown-session states before redirect decisions.

## Migration Plan

1. Implement mobile tRPC foundation (client/provider wiring + backend public provider procedure).
2. Introduce mobile auth scaffolding (client config, session bootstrap, route groups/guards).
3. Add login/callback/error screens and provider-driven login actions via tRPC provider discovery.
4. Wire protected tabs through auth guard and verify unauthenticated redirects.
5. Validate OAuth login round-trip on iOS and Android simulators.
6. Rollback plan: disable mobile auth gate by temporarily bypassing guard to restore current open-access behavior while preserving new code paths behind a feature flag/config switch if needed.

## Open Questions

- None at this time.
