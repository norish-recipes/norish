# 07 — Step Ingredients in cooking mode and on share pages

**What to build:** Cooking mode shows the current step's ingredients and amounts — the information in front of the cook exactly when hands are full — and public share pages render the same amounts beneath steps, so a shared recipe is as usable for its recipient as for the household that owns it.

**Blocked by:** 03 — Step Ingredients foundation.

**Spec:** `.scratch/general-improvements/spec.md`

**Status:** done

- [x] Cooking mode presents the active step's Step Ingredients with resolved amounts, following the active measurement system.
- [x] Public share pages render amounts beneath steps through the public renderer variant, exposing nothing beyond the recipe's own content.
- [x] Both surfaces are covered in their respective test suites, including harness e2e assertions.

## Comments

- Shipped in 2c0936cc. Cooking mode shows the active step's resolved amounts beneath the instruction (servings-adjusted, active system); public share pages carry references through PublicRecipeStepSchema (order-based, no ids) and render the same amounts with the share's unit config. Component, repository, and harness e2e coverage included.
