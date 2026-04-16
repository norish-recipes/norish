## ADDED Requirements

### Requirement: Shared recipe pages render a readonly recipe detail view on the web

The web app SHALL render a readonly public recipe page for a valid share token using the shared recipe contract returned for `/share/[token]`.

#### Scenario: Valid token shows the shared recipe page

- **WHEN** a user opens `/share/[token]` with a valid active public recipe share token
- **THEN** the system SHALL render the shared recipe content on the web without requiring an authenticated session
- **AND** the page SHALL display the recipe media, summary content, ingredients, steps, and any optional readonly notes or nutrition data present in the shared payload

#### Scenario: Invalid token does not render protected recipe content

- **WHEN** a user opens `/share/[token]` with an invalid, expired, revoked, or deleted share token
- **THEN** the system SHALL NOT render the protected recipe content
- **AND** the page SHALL fall back to the web app's not-found or equivalent denied-access experience without revealing which invalid state occurred

### Requirement: Shared recipe pages remain outside the authenticated app shell

The web app SHALL keep the public shared recipe route outside the authenticated `(app)` route group and SHALL NOT require the authenticated app shell to render shared content.

#### Scenario: Shared recipe page uses a lightweight route boundary

- **WHEN** the system renders `/share/[token]`
- **THEN** it SHALL NOT mount the `(app)` layout with its authenticated navbar, timer dock, and app-scoped user, household, permissions, or recipes providers
- **AND** it SHALL only mount the minimal providers required for the readonly shared page experience

### Requirement: Shared recipe pages omit authenticated-only recipe controls

The web app SHALL keep shared recipe pages visually aligned with the recipe detail experience while omitting authenticated-only controls and navigation.

#### Scenario: Shared recipe page is rendered in readonly mode

- **WHEN** the shared recipe page is shown for a valid token
- **THEN** the page SHALL NOT show the recipe back button, actions menu, edit controls, grocery actions, favorite controls, rating controls, or AI actions
- **AND** the page SHALL preserve the established responsive recipe-detail styling patterns instead of introducing a separate monolithic layout
