## ADDED Requirements

### Requirement: Mobile recipe detail context provides live recipe data

The system SHALL provide a `RecipeDetailProvider` for the mobile recipe detail screen that fetches, caches, and subscribes to real-time updates for a single recipe by ID, using the shared `createRecipeDetailContext` factory.

#### Scenario: Recipe loads from backend on navigation

- **WHEN** the user navigates to a recipe detail screen with a valid recipe ID
- **THEN** the provider fetches the `FullRecipeDTO` via tRPC and makes it available to child components through context

#### Scenario: Recipe updates in real-time

- **WHEN** the recipe is modified externally (e.g., by another user or device)
- **THEN** the provider receives the update via subscription and re-renders child components with new data

### Requirement: Mobile recipe detail screen shows loading state

The system SHALL display a loading indicator while the recipe data is being fetched from the backend.

#### Scenario: Loading state renders before data arrives

- **WHEN** the recipe detail screen mounts and data has not yet loaded
- **THEN** the screen displays a loading indicator instead of recipe content

### Requirement: Mobile recipe detail screen handles not-found

The system SHALL display a not-found state when the recipe ID does not correspond to an existing recipe.

#### Scenario: Invalid recipe ID shows not-found

- **WHEN** the user navigates to a recipe detail screen with a non-existent recipe ID
- **THEN** the screen displays a not-found message instead of recipe content

### Requirement: Ingredient scaling uses shared context

The system SHALL use the `RecipeDetailProvider`'s `setIngredientAmounts` and `adjustedIngredients` for ingredient scaling, instead of local component state.

#### Scenario: Servings change updates all ingredient amounts

- **WHEN** the user adjusts the servings control on the ingredients section
- **THEN** both the ingredient list and cook mode reflect the scaled amounts via the shared context

### Requirement: Recipe rating persists to backend

The system SHALL persist rating changes via `useRatingsMutation` when the user rates a recipe on the detail screen.

#### Scenario: User submits a rating

- **WHEN** the user taps a star rating on the recipe detail screen
- **THEN** the rating is sent to the backend and persisted

### Requirement: Recipe favorite toggle persists to backend

The system SHALL persist favorite state changes via `useFavoritesMutation` when the user toggles the liked button.

#### Scenario: User toggles favorite

- **WHEN** the user taps the heart/liked button on the recipe detail screen
- **THEN** the favorite state is toggled on the backend and the UI reflects the new state

### Requirement: Recipe images use authenticated URIs

The system SHALL resolve relative image URLs against the backend base URL and include authentication headers when loading recipe images.

#### Scenario: Relative image URL resolves correctly

- **WHEN** a recipe has an image with a relative URL path
- **THEN** the image component receives an absolute URL with the backend base prepended and auth headers attached

### Requirement: Recipe detail components accept FullRecipeDTO data shapes

The system SHALL update all recipe detail components to accept data shapes from `FullRecipeDTO` and its associated DTOs instead of the dummy types.

#### Scenario: Components render with real recipe data

- **WHEN** a recipe is loaded from the backend
- **THEN** all components (ingredients, steps, nutrition, media header, author, highlights, tags) render correctly using the DTO field names and types

### Requirement: Dummy data module is removed

The system SHALL remove the `dummy-data.ts` file and all imports of `Dummy*` types once all components are wired to real data.

#### Scenario: No references to dummy data remain

- **WHEN** the change is complete
- **THEN** no source files import from `dummy-data.ts` and the file is deleted
