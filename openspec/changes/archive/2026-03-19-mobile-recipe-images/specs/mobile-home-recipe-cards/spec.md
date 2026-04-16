# mobile-home-recipe-cards Specification (Delta)

## MODIFIED Requirements

### Requirement: Recipe card exposes required metadata

Each mobile recipe card SHALL present the recipe image, title, description limited to two lines, servings, rating as a 1-5 star display, tags, course, liked state as a heart icon, and total duration. The recipe image SHALL be resolved using the canonical `resolveImageUrl` helper from `resolve-image-url.ts`, and SHALL render a `NoImagePlaceholder` when the image URL is missing or fails to load.

#### Scenario: Card displays all metadata fields

- **WHEN** a recipe card is rendered
- **THEN** the card SHALL show all required metadata fields
- **AND** the description text SHALL be clamped to at most two lines

#### Scenario: Rating display bounds

- **WHEN** a recipe card includes a rating value
- **THEN** the star display SHALL render a value between 1 and 5 inclusive
- **AND** values outside this range SHALL be normalized before display

#### Scenario: Card image resolved via canonical helper

- **WHEN** a recipe card is constructed from a `RecipeDashboardDTO`
- **THEN** the image URL SHALL be resolved using `resolveImageUrl` from `resolve-image-url.ts`
- **AND** auth cookie headers SHALL be attached to the image source when available

#### Scenario: Card image fails to load

- **WHEN** the recipe card image URL returns a 404 or network error
- **THEN** the card SHALL render a `NoImagePlaceholder` component in place of the broken image
