## ADDED Requirements

### Requirement: Home screen renders a search bar via bottom accessory

The Recipes (home) tab SHALL render a `bottomAccessory` component that displays a tappable search bar. When expanded, it appears above the tab bar; when the tab bar is minimized (collapsed), it appears inline with the tab bar row.

#### Scenario: Search bar is visible above expanded tab bar

- **WHEN** the user is on the Recipes tab and the tab bar is in its expanded (non-minimized) state
- **THEN** a search bar component is rendered above the tab bar via `bottomAccessory` with `placement: "regular"`

#### Scenario: Search bar is visible inline with minimized tab bar

- **WHEN** the tab bar is in its minimized/collapsed state on the Recipes tab
- **THEN** a search bar component is rendered inline alongside the collapsed tab icons via `bottomAccessory` with `placement: "inline"`

#### Scenario: Tapping search bar navigates to search screen

- **WHEN** the user taps the search bar in the bottom accessory
- **THEN** the app navigates to the search screen (`/search`) where the user can enter a search query
