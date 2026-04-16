## REMOVED Requirements

### Requirement: Start screen uses HeroUI Card

**Reason**: The requirement is tied to Expo starter-template content that is being removed from the production mobile shell.
**Migration**: Move to product-focused home screen composition and remove starter panel dependencies from routes and tabs.

## ADDED Requirements

### Requirement: Mobile shell navigation is product-focused

The mobile UI capability SHALL present navigation that prioritizes product destinations and excludes starter-template walkthrough content.

#### Scenario: Tab/navigation model excludes starter walkthrough surfaces

- **WHEN** the root mobile shell is rendered
- **THEN** navigation controls SHALL reference only active product routes
- **AND** starter-template labels, doc links, and walkthrough entries SHALL NOT be shown
