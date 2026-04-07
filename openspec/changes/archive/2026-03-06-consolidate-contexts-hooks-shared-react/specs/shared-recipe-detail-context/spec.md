## ADDED Requirements

### Requirement: Shared recipe detail context factory is provided from shared-react

The system SHALL expose a `createRecipeDetailContext` factory from `@norish/shared-react/contexts` that creates a recipe-detail provider and hooks, accepting platform-specific adapters for recipe query, subscription, nutrition, auto-tagging, allergy detection, and measurement conversion.

#### Scenario: Web creates recipe detail context with all adapters

- **WHEN** the web app calls `createRecipeDetailContext` with query, subscription, nutrition, auto-tagging, auto-categorization, allergy detection, and allergy source adapters
- **THEN** the returned `RecipeContextProvider`, `useRecipeContext`, and `useRecipeContextRequired` SHALL function identically to the current web implementation

### Requirement: Recipe detail context orchestrates AI feature hooks

The factory SHALL wire nutrition estimation, auto-tagging, auto-categorization, and allergy detection through injected adapters so the context provides a unified API for all AI recipe features.

#### Scenario: Context exposes all AI actions

- **WHEN** a consumer accesses the recipe detail context
- **THEN** it SHALL include `estimateNutrition`, `triggerAutoTag`, `triggerAutoCategorize`, and `triggerAllergyDetection` actions with corresponding loading states
