## MODIFIED Requirements

### Requirement: Native search tab behavior is enabled

The mobile shell SHALL surface search from the Recipes (home) tab using a `bottomAccessory` search bar component, not from a dedicated search tab trigger in the tab bar. The search entry point SHALL be accessible as a tappable search bar rendered via `bottomAccessory` on the Recipes tab.

#### Scenario: Search entrypoint appears as bottom accessory on home tab

- **WHEN** the native tab bar is rendered with the Recipes tab active
- **THEN** a search bar is visible as a bottom accessory (above or inline with the tab bar depending on minimize state)
- **AND** no dedicated search tab icon slot is present in the tab bar

#### Scenario: Search entrypoint routes to search experience

- **WHEN** the user taps the search bar in the bottom accessory
- **THEN** the app navigates to the search screen without replacing the four core destination tabs in the tab bar

## ADDED Requirements

### Requirement: Profile tab uses a custom profile icon

The Profile tab in the native bottom tab bar SHALL display a custom icon that visually communicates account/profile ownership, using SF Symbol `person.crop.circle` (filled variant when selected) on iOS and an equivalent icon on Android.

#### Scenario: Profile tab icon is displayed in the tab bar

- **WHEN** the native tab bar is rendered
- **THEN** the Profile tab displays the `person.crop.circle` SF Symbol on iOS (or equivalent icon on Android)

#### Scenario: Profile tab icon changes to filled variant when selected

- **WHEN** the user navigates to the Profile tab
- **THEN** the Profile tab icon changes to the filled variant (`person.crop.circle.fill`) on iOS to indicate the active state

## REMOVED Requirements

### Requirement: Native search tab trigger uses role="search"

**Reason**: The search entry point has moved from a `NativeTabs.Trigger` with `role="search"` to a `bottomAccessory` search bar on the Recipes tab. This gives a more contextual and ergonomic placement, especially with `tabBarMinimizeBehavior` enabled.
**Migration**: Remove the fifth `NativeTabs.Trigger` with `name="search"` and `role="search"`. The corresponding `/search` route and screen file remain unchanged and are navigated to from the `bottomAccessory` search bar.
