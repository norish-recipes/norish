## MODIFIED Requirements

### Requirement: Authenticated users can manage public recipe share links

The system SHALL allow an authenticated user with recipe edit access to create, list, update, revoke, reactivate, and delete public share links for a recipe, SHALL allow a user to list their own share links across recipes, and SHALL allow a server admin to review and moderate share links across the instance.

#### Scenario: User creates a share link with an expiration policy

- **WHEN** an authenticated user with recipe edit access creates a share link for a recipe and selects one of `1day`, `1week`, `1month`, `1year`, or `forever`
- **THEN** the system SHALL create a share record linked to that user and recipe
- **AND** the system SHALL generate a public URL in the form `/share/<token>`
- **AND** the system SHALL persist only a hash of the token, not the raw token value
- **AND** the system SHALL set `expiresAt` from the selected policy, using `null` for `forever`

#### Scenario: User manages an existing share link for a recipe

- **WHEN** an authenticated user with recipe edit access requests existing share links for a recipe or updates, revokes, reactivates, or deletes one of them
- **THEN** the system SHALL return share metadata and lifecycle state without returning the raw token again
- **AND** active, expired, and revoked links SHALL remain distinguishable in management responses

#### Scenario: User lists their own share links across recipes

- **WHEN** an authenticated user requests their share-link inventory outside a single recipe page
- **THEN** the system SHALL return the user's share links across recipes with the metadata needed to identify the linked recipe and current lifecycle status
- **AND** the response SHALL exclude raw token values

#### Scenario: Server admin reviews and moderates instance-wide share links

- **WHEN** a server admin requests the instance-wide share-link inventory or revokes, reactivates, or deletes a share link from that inventory
- **THEN** the system SHALL allow the operation without requiring recipe ownership
- **AND** the response SHALL include the metadata needed to identify the linked recipe, owning user, and current lifecycle state
- **AND** the response SHALL exclude raw token values
