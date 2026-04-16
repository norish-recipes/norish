# mobile-image-fallback Specification

## Purpose

Defines the reusable "No image" placeholder component and error-handling behaviour for all recipe image surfaces in the mobile app (recipe cards and recipe detail media header).

## ADDED Requirements

### Requirement: No-image placeholder component

The mobile app SHALL provide a reusable `NoImagePlaceholder` component that renders a visually styled container indicating that no image is available.

#### Scenario: Placeholder renders with icon and neutral background

- **WHEN** the `NoImagePlaceholder` component is rendered
- **THEN** it SHALL display a centred image-related icon
- **AND** the background SHALL use the app's neutral surface colour (`default-200` or equivalent)
- **AND** the component SHALL fill the available space of its parent container

#### Scenario: Placeholder adapts to context

- **WHEN** the `NoImagePlaceholder` component is rendered with a `variant` prop
- **THEN** variant `"card"` SHALL render at a size appropriate for recipe card thumbnails
- **AND** variant `"header"` SHALL render at full-bleed size appropriate for the recipe detail media header

### Requirement: Recipe detail media header handles image load errors

The `RecipeMediaHeader` component SHALL track per-slide image load errors and render the `NoImagePlaceholder` in place of any image slide whose URL fails to load.

#### Scenario: Single image slide fails to load

- **WHEN** a recipe has one image in its media items and that image URL returns a 404 or network error
- **THEN** the media header SHALL render the `NoImagePlaceholder` component in place of the failed image slide
- **AND** the placeholder SHALL occupy the full slide area

#### Scenario: One slide in a multi-slide carousel fails

- **WHEN** a recipe has multiple media items and one image slide fails to load
- **THEN** only the failed slide SHALL show the `NoImagePlaceholder`
- **AND** all other slides SHALL continue to render normally
- **AND** pagination dots SHALL still reflect the total number of slides

#### Scenario: Recipe has no media items at all

- **WHEN** a recipe has an empty media items array (no images, no videos)
- **THEN** the media header SHALL render a single `NoImagePlaceholder` as the full-bleed background

### Requirement: Recipe card handles image load errors

The `RecipeCardImage` component SHALL render the `NoImagePlaceholder` when the card's image URL is missing or fails to load.

#### Scenario: Card image URL is empty

- **WHEN** a recipe card has an empty or null `imageUrl`
- **THEN** the card SHALL render the `NoImagePlaceholder` component in place of the image
- **AND** the rest of the card metadata (title, tags, etc.) SHALL still render normally

#### Scenario: Card image URL returns a 404

- **WHEN** the card's image URL fails to load (404, network error)
- **THEN** the card SHALL replace the broken image with the `NoImagePlaceholder` component
- **AND** there SHALL be no visible flash of a black or blank container before the placeholder appears
