## ADDED Requirements

### Requirement: Recipe detail page exposes share-link management in a bottom panel

The web app SHALL let a user open recipe share-link management from the recipe detail page and complete per-recipe share lifecycle actions in a bottom panel.

#### Scenario: User opens the share management panel from a recipe they can manage

- **WHEN** a user with permission to manage a recipe opens the recipe actions menu on the web recipe detail page and selects the share action
- **THEN** the system SHALL open a bottom panel for that recipe instead of navigating away
- **AND** the panel SHALL show the existing share links for that recipe with their lifecycle status
- **AND** the panel SHALL include a create-link flow in the same surface

#### Scenario: User performs lifecycle actions from the panel

- **WHEN** the panel shows existing share links for a recipe
- **THEN** each row SHALL expose the lifecycle actions allowed for its current status
- **AND** active links SHALL support revoke and permanent delete
- **AND** revoked links SHALL support reactivate and permanent delete
- **AND** newly created links SHALL expose the generated public URL for immediate copy or sharing

### Requirement: User settings page lists and manages the current user's share links

The web app SHALL provide a user settings management surface that lists the current user's recipe share links across recipes and allows lifecycle actions from that inventory.

#### Scenario: User reviews their share-link inventory

- **WHEN** the current user opens the user settings page
- **THEN** the system SHALL show a dedicated share-link management table in that page
- **AND** each row SHALL identify the linked recipe, lifecycle status, and key lifecycle timestamps relevant to management

#### Scenario: User manages a link from settings

- **WHEN** the user revokes, reactivates, or permanently deletes a share link from the user settings table
- **THEN** the system SHALL apply the requested lifecycle change
- **AND** the table SHALL refresh to show the updated status or removal

### Requirement: Admin settings page supports instance-wide share-link oversight

The web app SHALL provide an admin settings management surface that lists public recipe share links across the instance and allows administrative lifecycle actions.

#### Scenario: Server admin reviews instance-wide share links

- **WHEN** a server admin opens the admin settings page
- **THEN** the system SHALL show a dedicated share-link management table for the whole instance
- **AND** each row SHALL identify the owning user, linked recipe, lifecycle status, and management timestamps needed for moderation or support

#### Scenario: Server admin moderates a share link

- **WHEN** a server admin revokes, reactivates, or permanently deletes a share link from the admin table
- **THEN** the system SHALL apply the lifecycle change without requiring the admin to open the underlying recipe page
- **AND** the admin table SHALL refresh to show the updated status or removal
