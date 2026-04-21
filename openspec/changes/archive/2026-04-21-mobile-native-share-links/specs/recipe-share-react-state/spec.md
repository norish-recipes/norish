## MODIFIED Requirements

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

#### Scenario: Share creation can return the created share payload to the caller
- **WHEN** an authenticated shared-react consumer creates a share link and needs to use the created public URL immediately
- **THEN** the shared-react create-share contract SHALL expose the confirmed server response for that newly created share
- **AND** the response SHALL remain consistent with shared-react cache invalidation and server-backed mutation state
