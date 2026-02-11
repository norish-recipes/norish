## ADDED Requirements

### Requirement: Recipe Directory Ownership Cleanup

The cleanup process SHALL treat each directory directly under `uploads/recipes/` as recipe-scoped storage and SHALL delete the directory when its name is not present in `recipes.id`.

#### Scenario: Directory is not linked to a recipe

- **WHEN** cleanup scans `uploads/recipes/` and finds a directory name that is not present in the `recipes` table
- **THEN** the system SHALL delete that directory recursively
- **AND** cleanup SHALL continue processing remaining directories

#### Scenario: Directory belongs to an existing recipe

- **WHEN** cleanup scans a directory name that matches an existing `recipes.id`
- **THEN** the system SHALL keep the directory and evaluate orphaned files inside it

### Requirement: Root Recipe Media Reconciliation

The cleanup process SHALL reconcile root-level recipe media files against DB references from `recipes.image` (recipe thumbnail path), `recipe_images.image`, and `recipe_videos.video` and SHALL delete root files that are not referenced.

#### Scenario: Recipe thumbnail reference is preserved

- **WHEN** a root-level media file is referenced by `recipes.image` for that recipe
- **THEN** the system SHALL keep that file

#### Scenario: Orphaned root-level image is removed

- **WHEN** a file in `uploads/recipes/{recipeId}/` is not referenced by `recipes.image` or `recipe_images.image`
- **THEN** the system SHALL delete that file

#### Scenario: Orphaned root-level video is removed

- **WHEN** a file in `uploads/recipes/{recipeId}/` is not referenced by `recipe_videos.video`
- **THEN** the system SHALL delete that file

#### Scenario: Referenced root media is preserved

- **WHEN** a root-level file is referenced by one of the configured DB media columns
- **THEN** the system SHALL keep that file

### Requirement: Step Image Reconciliation

The cleanup process SHALL reconcile step image files in `uploads/recipes/{recipeId}/steps/` against `step_images.image` and SHALL delete step files that are not referenced.

#### Scenario: Orphaned step image is removed

- **WHEN** a file in `uploads/recipes/{recipeId}/steps/` is not referenced in `step_images.image`
- **THEN** the system SHALL delete that file

#### Scenario: Referenced step image is preserved

- **WHEN** a file in `uploads/recipes/{recipeId}/steps/` is referenced in `step_images.image`
- **THEN** the system SHALL keep that file
