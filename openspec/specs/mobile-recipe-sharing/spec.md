# mobile-recipe-sharing Specification

## Purpose

Defines the main mobile recipe-sharing behavior for creating and sharing Norish public recipe links while keeping source-link access separate.

## Requirements

### Requirement: Mobile recipe sharing uses a Norish public share URL

The mobile recipe detail Share action SHALL create a Norish public recipe share link and SHALL present that Norish share URL through the native platform share sheet instead of sharing the recipe's original source URL.

#### Scenario: User shares a recipe from mobile

- **WHEN** an authenticated mobile user taps Share from a recipe detail screen for a recipe they are allowed to share
- **THEN** the mobile client SHALL request a public recipe share link for that recipe from the existing share-create flow
- **AND** the mobile client SHALL invoke the native share sheet with the returned Norish public share URL
- **AND** the shared payload SHALL NOT use `recipe.url` as the shared destination URL

### Requirement: Mobile creates non-expiring share links for v1

The mobile recipe detail Share action SHALL create public recipe share links with the `forever` expiration policy until mobile exposes explicit expiry controls.

#### Scenario: Mobile creates a link for sharing

- **WHEN** the mobile client creates a public recipe share link for the Share action
- **THEN** it SHALL request the `forever` expiration policy
- **AND** the resulting public share record SHALL have no expiration timestamp

### Requirement: Mobile preserves source-link access as a separate action

The mobile recipe detail screen SHALL keep opening the original recipe source URL behind a separate Visit Original action instead of combining that source-link behavior with the Share action.

#### Scenario: User wants to open the imported source

- **WHEN** a recipe has an original source URL and the mobile user selects Visit Original
- **THEN** the mobile client SHALL open the original source URL directly
- **AND** that action SHALL remain distinct from the Norish public-share flow

### Requirement: Mobile does not fall back to the source URL when share-link creation fails

The mobile client SHALL treat public-share creation failure as a share failure and SHALL NOT silently share the recipe's original source URL instead.

#### Scenario: Share-link creation fails

- **WHEN** the mobile Share action cannot create a Norish public share link
- **THEN** the mobile client SHALL surface an error to the user
- **AND** the mobile client SHALL NOT invoke the share sheet with `recipe.url`
