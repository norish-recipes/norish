# public-recipe-sharing Specification

## Purpose

Define how Norish exposes recipe sharing through revocable public links, including owner-managed share lifecycle, readonly anonymous recipe access, and token-gated shared media delivery.

## Requirements

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

### Requirement: Public share tokens resolve readonly recipe data

The system SHALL allow anonymous callers to resolve a shared recipe only through a valid active share token.

#### Scenario: Valid share token returns a shared recipe

- **WHEN** an anonymous caller requests a shared recipe with a token whose hashed value matches an existing share record that is not expired or revoked
- **THEN** the system SHALL resolve the linked recipe
- **AND** the system SHALL return the public readonly recipe contract for that recipe

#### Scenario: Invalid, expired, or revoked token is rejected uniformly

- **WHEN** an anonymous caller requests a shared recipe with a token that does not match an active share record
- **THEN** the system SHALL deny access
- **AND** the response SHALL NOT reveal whether the token was missing, invalid, expired, or revoked

### Requirement: Shared recipes use a sanitized public DTO

The system SHALL expose a dedicated readonly public recipe contract for shared recipes instead of reusing the authenticated full-recipe contract directly.

#### Scenario: Public recipe payload excludes internal mutable fields

- **WHEN** the system returns a shared recipe payload
- **THEN** it SHALL include the data needed to render a readonly recipe detail view, including content, ingredients, steps, timings, nutrition, categories, tags, and share-scoped media URLs
- **AND** it SHALL NOT expose internal mutable fields such as recipe ownership identifiers or optimistic-concurrency version fields

### Requirement: Shared recipe media remains token-gated

The system SHALL allow anonymous access to recipe and step media for shared recipes only when the request is authorized by a valid share token tied to that recipe.

#### Scenario: Shared media request succeeds with a valid share token

- **WHEN** an anonymous caller requests shared recipe media with a valid share token for the linked recipe
- **THEN** the system SHALL serve the media without requiring an authenticated session
- **AND** the auth proxy SHALL allow that share-scoped request path through

#### Scenario: Non-shared media request remains protected

- **WHEN** an anonymous caller requests recipe or step media without valid share authorization
- **THEN** the system SHALL NOT serve the media as public content
- **AND** proxy/public-asset rules SHALL NOT depend on broad file-extension bypasses that expose unrelated private media
