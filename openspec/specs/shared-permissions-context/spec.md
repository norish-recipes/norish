# shared-permissions-context Specification

## Purpose

Defines the shared React shared permissions context factory pattern in `@norish/shared-react`, enabling both web and mobile to consume this functionality through a common, app-agnostic factory/adapter pattern.

## Requirements

### Requirement: Shared permissions context factory is provided from shared-react

The system SHALL expose a `createPermissionsContext` factory from `@norish/shared-react/contexts` that creates a permissions provider and hook pair, accepting platform-specific adapters for user identity and permissions data.

#### Scenario: Web creates permissions context with web user adapter

- **WHEN** the web app calls `createPermissionsContext` with its `useCurrentUserId` adapter (sourcing from `useUserContext`)
- **THEN** the returned `PermissionsProvider` and `usePermissionsContext` SHALL function identically to the current web permissions context

#### Scenario: Mobile creates permissions context with mobile user adapter

- **WHEN** the mobile app calls `createPermissionsContext` with its `useCurrentUserId` adapter (sourcing from `useAuth`)
- **THEN** the returned `PermissionsProvider` and `usePermissionsContext` SHALL function identically to the current mobile permissions context

### Requirement: Permissions context contract is identical across platforms

The system SHALL define a single `PermissionsContextValue` type that both web and mobile consumers use, ensuring identical API surface.

#### Scenario: Context value shape matches unified contract

- **WHEN** a consumer accesses the permissions context
- **THEN** the value SHALL include `recipePolicy`, `isAIEnabled`, `householdUserIds`, `isServerAdmin`, `autoTaggingMode`, `isAutoTaggingEnabled`, `isLoading`, `canViewRecipe`, `canEditRecipe`, and `canDeleteRecipe`

### Requirement: Permissions context core logic is platform-safe

The shared permissions context factory SHALL NOT import platform-specific modules. All platform dependencies SHALL be injected through the factory options.

#### Scenario: Shared permissions context avoids platform-only dependencies

- **WHEN** shared-react permissions context modules are evaluated in both web and mobile builds
- **THEN** they SHALL NOT require browser-only or native-only modules

### Requirement: Legacy permissions context paths remain temporarily compatible

Both web and mobile apps SHALL re-export the shared context through their existing import paths during migration.

#### Scenario: Existing imports continue to function

- **WHEN** a web consumer imports `usePermissionsContext` from `@/context/permissions-context`
- **THEN** the import SHALL resolve to the shared implementation wrapped with the web user adapter
