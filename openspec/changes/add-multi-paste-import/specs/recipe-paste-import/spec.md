## ADDED Requirements

### Requirement: Paste import accepts structured JSON-LD recipe payloads

The system SHALL accept pasted JSON-LD recipe payloads on the existing paste import endpoint when AI-only mode is not requested. Structured JSON-LD input MAY be a single recipe object, a top-level array, or a graph that contains multiple recipe nodes.

#### Scenario: Single JSON-LD recipe imports without AI

- **WHEN** a paste import request contains a valid JSON-LD payload with one recipe node and `forceAI` is not enabled
- **THEN** the system SHALL parse and normalize that recipe without requiring AI fallback
- **AND** the import response SHALL include one created recipe ID in `recipeIds`

#### Scenario: JSON-LD array imports all recipe nodes

- **WHEN** a paste import request contains a valid JSON-LD top-level array with multiple recipe nodes
- **THEN** the system SHALL import every valid recipe node in that array
- **AND** the import response SHALL return the created IDs in `recipeIds`

#### Scenario: JSON-LD graph imports all recipe nodes

- **WHEN** a paste import request contains a valid JSON-LD payload with an `@graph` that includes multiple recipe nodes
- **THEN** the system SHALL detect and import every valid recipe node in the graph
- **AND** non-recipe nodes in the same graph SHALL NOT be imported as recipes

### Requirement: Paste import accepts structured YAML recipe payloads

The system SHALL accept pasted YAML recipe payloads on the existing paste import endpoint when AI-only mode is not requested. Structured YAML input MAY be a single recipe mapping or an array of recipe mappings.

#### Scenario: Single YAML recipe imports without AI

- **WHEN** a paste import request contains a valid YAML mapping for one recipe and `forceAI` is not enabled
- **THEN** the system SHALL parse and normalize that recipe without requiring AI fallback
- **AND** the import response SHALL include one created recipe ID in `recipeIds`

#### Scenario: YAML array imports multiple recipes

- **WHEN** a paste import request contains a valid YAML array of recipe mappings
- **THEN** the system SHALL import every valid recipe mapping in the array
- **AND** the import response SHALL return the created IDs in `recipeIds`

### Requirement: Structured YAML fields normalize into Norish recipe data

The system SHALL normalize supported YAML fields into Norish's internal recipe DTO using `title` as the user-facing name field and explicit structured collections for ingredients and steps.

#### Scenario: YAML aliases normalize to canonical media fields

- **WHEN** a YAML recipe provides `image` or `video`
- **THEN** the system SHALL accept them as aliases for the canonical `images` and `videos` fields during normalization

#### Scenario: Tags accept array or comma-separated string

- **WHEN** a YAML recipe provides `tags` as an array or a comma-separated string
- **THEN** the system SHALL normalize the tags into the canonical deduplicated tag collection

#### Scenario: Ingredients and steps require array semantics

- **WHEN** a YAML recipe provides `ingredients` or `steps`
- **THEN** the system SHALL treat those fields as ordered arrays rather than applying ad hoc comma-splitting rules

#### Scenario: Supported metadata fields are preserved

- **WHEN** a YAML recipe includes `description`, `servings`, `prepMinutes`, `cookMinutes`, `totalMinutes`, `categories`, `nutrition`, `notes`, or `sourceUrl`
- **THEN** the system SHALL map those supported fields into the normalized recipe DTO when their values are valid

### Requirement: Paste import uses a batch-capable response contract on the existing endpoint

The paste import endpoint SHALL remain a single endpoint for single and multi-recipe imports and SHALL return success responses as an object with a `recipeIds: string[]` field.

#### Scenario: Single recipe import uses batch-capable response

- **WHEN** a paste import creates exactly one recipe
- **THEN** the system SHALL return `{ recipeIds: [<recipe-id>] }` rather than a bare UUID response

#### Scenario: Multi recipe import uses same endpoint contract

- **WHEN** a paste import creates multiple recipes
- **THEN** the system SHALL return all created recipe IDs in the same `recipeIds` field on the existing endpoint

### Requirement: Structured paste import preserves AI fallback for unstructured text

The system SHALL preserve the existing AI fallback path for unstructured paste text when AI is enabled, while valid structured JSON-LD or YAML imports SHALL not require AI.

#### Scenario: Valid structured input bypasses AI fallback

- **WHEN** pasted input is valid JSON-LD or valid YAML and `forceAI` is not enabled
- **THEN** the system SHALL complete the import from structured parsing without invoking AI fallback

#### Scenario: Unstructured text may still use AI fallback

- **WHEN** pasted input does not produce a valid JSON-LD or YAML parse and AI fallback is enabled
- **THEN** the system SHALL continue to the existing AI import path

#### Scenario: AI-only mode overrides structured parsing

- **WHEN** a paste import explicitly requests `forceAI`
- **THEN** the system SHALL bypass structured JSON-LD and YAML parsing and use the AI path directly

### Requirement: Structured multi-import validates items independently

The system SHALL validate structured multi-import items independently and import all valid recipes from a payload, subject to configured limits.

#### Scenario: Invalid items do not block valid items

- **WHEN** a structured multi-import payload contains both valid and invalid recipe items
- **THEN** the system SHALL create recipes for the valid items
- **AND** invalid items SHALL be skipped rather than causing the entire payload to fail

#### Scenario: No valid items fails the import

- **WHEN** a structured multi-import payload contains no valid recipe items after validation
- **THEN** the system SHALL fail the import instead of returning an empty success result

#### Scenario: Recipe count limit is enforced

- **WHEN** a structured paste payload exceeds the configured maximum recipes per request
- **THEN** the system SHALL reject the import with a validation error before recipe creation begins

#### Scenario: Paste size limit still applies

- **WHEN** a paste import payload exceeds `MAX_RECIPE_PASTE_CHARS`
- **THEN** the system SHALL reject the import using the existing payload-size protection regardless of input format

### Requirement: Imported structured ratings become Norish user ratings

The system SHALL convert a structured imported `rating` into a Norish user rating for the authenticated importing user instead of storing it as separate source metadata.

#### Scenario: Imported rating creates a user rating for the importing user

- **WHEN** a created recipe originates from a structured import item that includes `rating`
- **THEN** the system SHALL create a Norish rating owned by the authenticated importing user for that recipe
- **AND** recipe aggregates such as `averageRating` and `ratingCount` SHALL be updated through the same repository logic used by ordinary ratings

#### Scenario: Decimal rating is normalized to supported precision

- **WHEN** a structured import includes a fractional rating value such as `4.5`
- **THEN** the system SHALL round that value to the nearest supported whole-number rating before persistence
- **AND** the normalized rating SHALL be clamped to the allowed rating range

#### Scenario: Existing rating is overwritten during import retry or reprocessing

- **WHEN** the authenticated importing user already has a rating for a created recipe being processed by structured import
- **THEN** the system SHALL update that existing user rating to the imported normalized value instead of creating duplicate ratings

#### Scenario: Multi import applies ratings per created recipe

- **WHEN** a structured multi-import creates multiple recipes and multiple items include ratings
- **THEN** the system SHALL create or update the importing user's Norish rating for each created recipe independently

### Requirement: Paste import documentation includes concrete structured examples

The system SHALL document the structured paste import contract in Scalar/OpenAPI with concrete examples for each supported structured shape.

#### Scenario: Structured examples are present in API documentation

- **WHEN** the paste import endpoint documentation is viewed
- **THEN** it SHALL include examples for JSON-LD single, JSON-LD multiple, YAML single, and YAML multiple payloads
