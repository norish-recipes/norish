## ADDED Requirements

### Requirement: Auth tRPC calls are encapsulated in dedicated hooks

The mobile app SHALL have a hook layer under `src/hooks/trpc/<domain>/` for tRPC queries and mutations. Auth-screen tRPC calls SHALL be extracted from screen/component files into these hooks, following the web app pattern.

#### Scenario: Auth providers query is called via a named hook

- **WHEN** the login screen needs the list of auth providers
- **THEN** it SHALL call `useAuthProvidersQuery()` from `src/hooks/trpc/login/use-auth-providers-query.ts`
- **AND** the hook SHALL return `{ providers, registrationEnabled, passwordAuthEnabled, isLoading, error, refetch }`
- **AND** the screen file SHALL NOT call `useTRPC()` or `useQuery` directly for this data

#### Scenario: Hook is reusable across screens

- **WHEN** another screen or component needs the auth provider list
- **THEN** it SHALL import and call `useAuthProvidersQuery()` without duplicating the query configuration

### Requirement: Connect-screen backend URL startup logic is encapsulated in a hook

The startup effect in the connect screen (load stored URL → redirect if URL exists + cold start, prefill if URL exists + navigated, show empty if no URL) SHALL be extracted into `src/hooks/use-backend-url.ts`.

#### Scenario: Hook handles cold start with existing URL

- **WHEN** `useBackendUrl()` is called and a backend URL is stored and the screen was not navigated to intentionally (cannot go back)
- **THEN** the hook SHALL navigate to `/login` via `router.replace`
- **AND** `isHydrated` SHALL remain `false` (screen shows loading until redirect)

#### Scenario: Hook handles intentional navigation with existing URL

- **WHEN** `useBackendUrl()` is called and a backend URL is stored and the user navigated here intentionally (`router.canGoBack()` is true)
- **THEN** the hook SHALL return the existing URL as `baseUrl`
- **AND** `isHydrated` SHALL be set to `true`

#### Scenario: Hook handles no stored URL

- **WHEN** `useBackendUrl()` is called and no backend URL is stored
- **THEN** `isHydrated` SHALL be set to `true` with an empty `baseUrl`
- **AND** the connect screen SHALL display the empty URL input form

#### Scenario: Connect screen uses the hook

- **WHEN** `ConnectScreen` renders
- **THEN** it SHALL call `useBackendUrl()` to obtain `{ baseUrl, setBaseUrl, isHydrated }`
- **AND** it SHALL NOT contain the startup `useEffect` logic inline
