## ADDED Requirements

### Requirement: BetterAuth Expo Integration

The mobile app SHALL use `@better-auth/expo` (client plugin `expoClient` and server plugin `expo()`) for all authentication flows instead of a custom bridge implementation.

#### Scenario: Server plugin registration

- **WHEN** the BetterAuth server instance is configured
- **THEN** the `expo()` plugin from `@better-auth/expo` SHALL be included in the plugins array
- **AND** `"mobile://"` SHALL be included in `trustedOrigins`
- **AND** the `bearer()` plugin SHALL NOT be present (cookie-based transport replaces it)

#### Scenario: Client initialization with dynamic backend URL

- **WHEN** a backend URL is available (user has completed the connect screen)
- **THEN** a BetterAuth auth client SHALL be created with that URL as `baseURL`
- **AND** the client SHALL use `expoClient` with `scheme: "mobile"`, `storagePrefix: "norish"`, and `expo-secure-store` as storage
- **AND** the client SHALL be reused for the same URL and recreated if the URL changes

#### Scenario: No backend URL configured

- **WHEN** no backend URL is stored
- **THEN** no auth client SHALL be created
- **AND** the app SHALL show the connect screen

### Requirement: Cookie-Based Session Transport

All authenticated requests from the mobile app SHALL use cookie-based session transport managed by the `expoClient` plugin.

#### Scenario: tRPC requests include session cookies

- **WHEN** the mobile app makes a tRPC request and the user is authenticated
- **THEN** the request SHALL include a `Cookie` header obtained from `authClient.getCookie()`
- **AND** the request SHALL use `credentials: "omit"` to prevent conflicts with manually set cookies

#### Scenario: Session persistence across app restarts

- **WHEN** the app is closed and reopened
- **THEN** the session cookie stored in `expo-secure-store` SHALL be available
- **AND** the user SHALL remain authenticated without re-login

### Requirement: OAuth Sign-In via Expo Plugin

OAuth sign-in flows SHALL be handled entirely by the `expoClient` plugin's built-in browser session management.

#### Scenario: Social provider sign-in (GitHub, Google)

- **WHEN** the user taps a social sign-in button
- **THEN** `authClient.signIn.social({ provider, callbackURL })` SHALL be called
- **AND** the `expoClient` plugin SHALL open the authorization proxy (`/expo-authorization-proxy`) in an in-app browser
- **AND** after successful authentication the plugin SHALL extract the session cookie from the deep link and store it in SecureStore

#### Scenario: OIDC provider sign-in

- **WHEN** the user taps an OIDC/generic OAuth sign-in button
- **THEN** the sign-in SHALL use the same `authClient.signIn.social` or equivalent mechanism
- **AND** the server SHALL perform the authorization code exchange with PKCE (as already configured on the `genericOAuth` plugin)

#### Scenario: Credential sign-in

- **WHEN** the user submits email and password
- **THEN** `authClient.signIn.email({ email, password })` SHALL be called
- **AND** the session cookie SHALL be stored automatically by the plugin

### Requirement: Route Protection via Stack.Protected

All route protection SHALL use Expo Router's `Stack.Protected` API in the root layout.

#### Scenario: Unauthenticated user accessing protected routes

- **WHEN** a user is not authenticated and attempts to navigate to a `(tabs)` route
- **THEN** Expo Router SHALL block navigation and redirect to the first available unprotected route (the `(auth)` group)

#### Scenario: Authenticated user accessing auth routes

- **WHEN** an authenticated user attempts to navigate to `(auth)` routes (login, connect)
- **THEN** Expo Router SHALL block navigation and redirect to the first available protected route (`(tabs)`)

#### Scenario: Session expiration while on protected route

- **WHEN** the user's session expires or is invalidated while on a `(tabs)` route
- **THEN** the `Stack.Protected` guard SHALL detect the auth state change
- **AND** the user SHALL be redirected to the `(auth)` group
- **AND** `(tabs)` history entries SHALL be removed from the navigation stack

#### Scenario: Loading state during session resolution

- **WHEN** the app starts and the session state has not yet resolved
- **THEN** neither `(auth)` nor `(tabs)` guard SHALL evaluate as true
- **AND** a loading indicator SHALL be shown until session state is determined

### Requirement: Unified Auth Screen Styling

The connect screen and login screen SHALL share a consistent visual layout.

#### Scenario: Visual consistency between connect and login

- **WHEN** the connect screen and login screen are displayed
- **THEN** both SHALL use the same layout structure: eyebrow text, large title, subtitle, card content area
- **AND** both SHALL use matching font sizes, padding, and spacing values
- **AND** both SHALL use `ScrollView` with vertical centering

#### Scenario: Transition between connect and login

- **WHEN** the user navigates from the connect screen to the login screen
- **THEN** a smooth animation SHALL play (fade or slide)
- **AND** both screens SHALL be within the `(auth)` route group sharing a `Stack` navigator

### Requirement: No Custom Auth Bridge Code

The custom server-side handoff bridge SHALL be fully removed.

#### Scenario: Custom endpoints removed

- **WHEN** the codebase is deployed
- **THEN** no `/api/mobile-auth/callback`, `/api/mobile-auth/exchange`, or `/api/mobile-auth/error` routes SHALL exist
- **AND** no in-memory handoff code store SHALL exist on the server

#### Scenario: Custom auth service removed from mobile

- **WHEN** the mobile app is built
- **THEN** no `mobile-auth-service.ts`, `mobile-auth-session-token.ts`, or `mobile-auth-guard.tsx` files SHALL exist
- **AND** no custom `exchangeMobileOAuthCode` or `completeOAuthCallback` functions SHALL exist

### Requirement: File and Export Naming

All mobile auth files and exports SHALL omit the `mobile-` prefix since they reside within `apps/mobile/`.

#### Scenario: Renamed files

- **WHEN** referencing auth-related files in `apps/mobile/`
- **THEN** files SHALL be named without the `mobile-` prefix (e.g., `auth-context.tsx` not `mobile-auth-context.tsx`)
- **AND** exported symbols SHALL use unprefixed names (e.g., `useAuth` not `useMobileAuth`, `TrpcProvider` not `MobileTrpcProvider`)

### Requirement: Metro Bundler Configuration

The Metro bundler SHALL be configured to resolve BetterAuth package exports.

#### Scenario: Package exports enabled

- **WHEN** the mobile app bundles
- **THEN** `unstable_enablePackageExports` SHALL be set to `true` in metro.config.js
- **AND** BetterAuth client imports (`better-auth/react`, `@better-auth/expo/client`) SHALL resolve correctly
