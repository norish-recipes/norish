## Why

The mobile app currently has no authentication, while web and server authentication are already implemented with BetterAuth and social OAuth providers. Adding mobile authentication now closes a core security and access gap and gives users a consistent sign-in experience across platforms.

## What Changes

- Add a mobile login page, authentication session handling, and unauthenticated entry flow for the app.
- Add mobile tRPC client wiring as a prerequisite capability for auth-related API consumption.
- Integrate the mobile login UI with the existing BetterAuth backend using the configured backend URL environment variable.
- Add a public tRPC provider-discovery route for unauthenticated login that mirrors `getAvailableProviders` semantics.
- Support the same social OAuth provider sign-in patterns used on web.
- Support optional single-provider auto-redirect behavior (parity with web) when exactly one OAuth provider is configured and credential auth is disabled.
- Ensure authenticated users are routed into protected app surfaces, while unauthenticated users are routed to login by default.

## Capabilities

### New Capabilities

- `mobile-trpc-foundation`: Mobile app tRPC client/provider wiring for consuming public and authenticated procedures.
- `mobile-auth-login`: Mobile authentication entry flow, including login screen rendering, social OAuth initiation, callback handling, and post-login navigation.

### Modified Capabilities

- None.

## Impact

- Affected code: mobile app routing/guards, mobile tRPC provider/client wiring, auth client integration, login UI screens/components.
- Affected APIs: add a public tRPC provider-discovery procedure; continue using existing BetterAuth endpoints for auth execution.
- Dependencies: existing BetterAuth setup, configured social OAuth providers, mobile deep link/callback handling.
- Configuration: relies on existing environment variable that defines backend base URL.
