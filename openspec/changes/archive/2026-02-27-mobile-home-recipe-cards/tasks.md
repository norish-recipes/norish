## 1. Discover and shape home screen data

- [x] 1.1 Review existing mobile home/start route and identify insertion point for recipe list rendering.
- [x] 1.2 Define `MobileRecipeCardItem` view model with fields for image, title, description, servings, rating, tags, course, liked, and total duration.
- [x] 1.3 Add deterministic mock recipe dataset and mapping helpers for the new view model.

## 2. Build native recipe card UI

- [x] 2.1 Implement a reusable mobile recipe card component with HeroUI Native building blocks and Tailwind utilities, including image, title, and two-line description clamp.
- [x] 2.2 Add metadata rows for servings, star rating (1-5), liked heart icon, and total duration.
- [x] 2.3 Render tags and course as compact labels/chips with mobile-friendly wrapping and spacing.
- [x] 2.4 Avoid bespoke CSS-style overrides unless required for gaps not covered by HeroUI Native or Tailwind utilities.

## 3. Integrate list into home experience

- [x] 3.1 Create a vertically scrollable home recipe list that renders recipe cards from the mock dataset.
- [x] 3.2 Add empty-state handling for no recipes and ensure safe-area-aware layout remains intact.
- [x] 3.3 Match mobile visual hierarchy to the web recipe grid intent while preserving native touch ergonomics.

## 4. Validate and polish

- [x] 4.1 Verify description clamp, star bounds, and metadata visibility across representative device sizes.
- [x] 4.2 Confirm stable list performance (keys, image sizing, re-render behavior) with the mock dataset.
- [x] 4.3 Add or update tests/snapshots for recipe card rendering and home list states where test coverage exists.
