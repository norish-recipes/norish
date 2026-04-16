## ADDED Requirements

### Requirement: Shared user context factory is provided from shared-react

The system SHALL expose a `createUserContext` factory from `@norish/shared-react/contexts` that creates a user provider and hook pair, accepting platform-specific adapters for session user data and sign-out behavior.

#### Scenario: Web creates user context with session and sign-out adapters

- **WHEN** the web app calls `createUserContext` with web-specific session user and sign-out adapters
- **THEN** the returned `UserProvider` and `useUserContext` SHALL provide the user, loading state, and sign-out functionality

#### Scenario: Mobile creates user context with mobile auth adapters

- **WHEN** the mobile app calls `createUserContext` with mobile-specific auth adapters
- **THEN** the returned provider SHALL function correctly using mobile auth APIs

### Requirement: User context contract defines shared shape

The system SHALL define a base `UserContextValue` type that includes `user`, `isLoading`, and `signOut`. Platform-specific extensions (e.g., web's `userMenuOpen`) SHALL be added in app wrappers.

#### Scenario: Base context value is consistent across platforms

- **WHEN** a consumer accesses the shared user context
- **THEN** the value SHALL include at minimum `user` (User | null), `isLoading` (boolean), and `signOut` (() => void)
