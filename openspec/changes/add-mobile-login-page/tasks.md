## 1. Mobile Auth Foundation

- [ ] 1.1 Add mobile auth configuration module that reads backend base URL from environment and validates missing/invalid values
- [ ] 1.2 Introduce a mobile auth client/service wrapper for session checks, sign-in initiation, and sign-out using the configured backend URL
- [ ] 1.3 Add a public provider-discovery endpoint that reuses `getAvailableProviders` semantics and returns provider IDs/names/types for unauthenticated login

## 2. Route Protection and Session Guard

- [ ] 2.1 Add route structure for public auth surfaces (`login`, callback, auth error) and protected app surfaces (existing tabs)
- [ ] 2.2 Implement a centralized auth guard in mobile root layout/router logic that blocks protected routes until session resolution completes
- [ ] 2.3 Add startup loading state for pending session resolution to prevent protected-content flashes or redirect loops
- [ ] 2.4 Preserve intended protected destination when redirecting unauthenticated users to login

## 3. Login and OAuth Flow

- [ ] 3.1 Build mobile login screen UI with provider list, loading state, empty-provider state, and configuration-error state
- [ ] 3.2 Implement OAuth/social provider actions that launch auth flow against BetterAuth and use mobile deep-link callback URLs
- [ ] 3.3 Add callback handler route that finalizes authentication state and routes users to the preserved destination or default protected route
- [ ] 3.4 Add auth error screen/handling for failed OAuth callbacks with retry affordance
- [ ] 3.5 Implement single-provider auto-redirect parity with web (enabled only when exactly one OAuth provider exists and credential auth is disabled)
- [ ] 3.6 Ensure auto-redirect is skipped after explicit logout so users can remain on login

## 4. Session Lifecycle Enforcement

- [ ] 4.1 Ensure session invalidation/expiration during app lifetime re-triggers guard checks and redirects to login
- [ ] 4.2 Wire sign-out flow to clear mobile session state and return users to login

## 5. Verification

- [ ] 5.1 Validate unauthenticated launch behavior on iOS and Android (login shown, protected tabs blocked)
- [ ] 5.2 Validate successful OAuth round-trip on iOS and Android (provider launch, callback, session established, protected route access)
- [ ] 5.3 Validate callback failure path and missing/invalid backend URL behavior (clear error states, no broken sign-in actions)
