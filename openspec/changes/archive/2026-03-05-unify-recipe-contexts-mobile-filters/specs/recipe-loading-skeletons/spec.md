## ADDED Requirements

### Requirement: Recipe card skeleton component exists in shared mobile UI path

The system SHALL provide a `recipe-card-skeleton.tsx` component under `components/skeletons` for recipe card placeholder rendering.

#### Scenario: Skeleton component is available for list placeholders

- **WHEN** mobile recipe list screens require loading placeholders
- **THEN** they import and render `components/skeletons/recipe-card-skeleton.tsx`

### Requirement: Initial recipe page load shows skeleton cards

The system SHALL render recipe card skeletons during initial recipe page/dashboard/search loading before first data payload resolves.

#### Scenario: Initial load displays placeholder cards

- **WHEN** a recipe list page opens and no data has loaded yet
- **THEN** recipe card skeletons are shown until initial data is ready

### Requirement: Incremental recipe additions show skeleton placeholders

The system SHALL render skeleton placeholders for pending recipe cards while new recipes are being added or streamed into existing lists.

#### Scenario: New recipe insertion uses temporary skeleton slot

- **WHEN** a new recipe is being added and its full card data is not yet resolved
- **THEN** a recipe card skeleton is displayed in the target list position and replaced when data is available
