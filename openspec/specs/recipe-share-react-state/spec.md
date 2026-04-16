# recipe-share-react-state Specification

## Purpose

Defines the shared React recipe-share state contracts in `@norish/shared-react` so web and mobile can manage authenticated share links, resolve public shared recipes, synchronize share updates through visibility-scoped realtime events, and surface share state through reusable recipe detail context adapters.

## Requirements

### Requirement: Shared-react exposes authenticated recipe-share hooks

The system SHALL provide shared-react hooks for authenticated recipe-share management so web and mobile can list, create, update, revoke, and delete recipe share links through a common client contract.

#### Scenario: Client manages recipe shares through shared-react

- **WHEN** an authenticated shared-react consumer needs share state for a recipe
- **THEN** the system SHALL expose query and mutation hooks for the recipe's share list and share lifecycle actions from `packages/shared-react`
- **AND** those hooks SHALL return server-backed loading, error, and mutation state instead of relying on app-local wrappers

#### Scenario: Share creation does not rely on optimistic state

- **WHEN** an authenticated user creates a share link through the shared-react mutation contract
- **THEN** the system SHALL wait for the server response before treating the share as created in client state
- **AND** the initiating client SHALL refresh or update share queries from confirmed server data

### Requirement: Shared-react can resolve public shared recipes

The system SHALL provide a shared-react query hook for resolving the public shared recipe contract by token without requiring app-specific data wiring.

#### Scenario: Client loads a shared recipe from a token

- **WHEN** a shared-react consumer requests a public shared recipe with a token
- **THEN** the system SHALL expose the backend's readonly shared recipe contract through a shared-react query hook
- **AND** the hook SHALL surface normal query loading, success, and error states for UI consumers

### Requirement: Recipe share state synchronizes through visibility-scoped realtime events

The system SHALL synchronize authenticated recipe-share state through WebSocket subscription events whose audience matches the recipe view visibility policy.

#### Scenario: Share lifecycle event is scoped by recipe visibility

- **WHEN** a share link is created, updated, revoked, or deleted
- **THEN** the system SHALL emit a realtime event to `everyone`, the recipe household, or only the initiating user according to the recipe view policy
- **AND** clients outside that visibility scope SHALL NOT receive the event

#### Scenario: Visible clients refresh share state after a share event

- **WHEN** an authenticated client receives a recipe-share lifecycle event for a recipe it can observe
- **THEN** shared-react SHALL invalidate or refresh the affected recipe-share query data for that recipe
- **AND** the synchronization path SHALL work over the existing tRPC WebSocket subscription flow

### Requirement: Recipe detail context can surface share state without UI coupling

The system SHALL allow shared recipe detail context wiring to expose recipe-share state and actions without embedding platform-specific UI behavior.

#### Scenario: Recipe detail context is configured with share adapters

- **WHEN** a recipe detail provider includes recipe-share adapters
- **THEN** the context SHALL expose share query state, share lifecycle actions, and refresh behavior for the current recipe
- **AND** the context contract SHALL remain reusable across web and mobile consumers
