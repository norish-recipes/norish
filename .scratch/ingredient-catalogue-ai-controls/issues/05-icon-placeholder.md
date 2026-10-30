# 05 Icon placeholder in the Ingredients list and panel

Status: ready-for-agent

Spec: Solution 8

## What

- `IngredientIcon`'s `placeholder` renders a muted generic food glyph (from the icon set the app already uses) on the rounded tile, replacing the grey square.
- The Ingredients list row (`ingredient-row.tsx`) passes `placeholder`. The panel already does.
- Groceries and the pantry stay as they are. Hidden Ingredient Icons still hide everything.

## Acceptance

- A list row and the panel for a food with no icon show the glyph; a food with one, or one borrowing its parent's, shows the icon.

## Comments

- 2026-10-23, implemented in be1a1ffc6. The glyph is Heroicons' outline `CakeIcon`, the only food glyph in the icon set the app uses. Covered by the `IngredientIcon` and Ingredients settings unit tests rather than E2E.
