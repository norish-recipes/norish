## MODIFIED Requirements

### Requirement: Mobile shell navigation is product-focused

The mobile UI capability SHALL present navigation that prioritizes product destinations and excludes starter-template walkthrough content. Recipe detail pages SHALL be presented outside the tab navigation stack as standalone full-screen experiences without bottom tab bar or bottom accessory.

#### Scenario: Tab/navigation model excludes starter walkthrough surfaces

- **WHEN** the root mobile shell is rendered
- **THEN** navigation controls SHALL reference only active product routes
- **AND** starter-template labels, doc links, and walkthrough entries SHALL NOT be shown

#### Scenario: Recipe detail is presented outside tab stack

- **WHEN** a user navigates to a recipe detail page from the dashboard or search
- **THEN** the recipe detail SHALL render as a full-screen route outside the `(tabs)` group
- **AND** the bottom tab bar SHALL NOT be visible
- **AND** the bottom accessory (e.g., "Add Recipe" button) SHALL NOT be visible

#### Scenario: Back navigation from recipe detail returns to tab context

- **WHEN** user navigates back from the recipe detail screen
- **THEN** the app SHALL return to the originating tab (dashboard or search) with its previous scroll position preserved
- **AND** the bottom tab bar and accessory SHALL reappear
