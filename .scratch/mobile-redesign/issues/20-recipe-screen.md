# 20: Recipe screen

**What to build:** The Recipe screen replacing the `/recipe/[id]` stub. See `.scratch/mobile-redesign/spec.md` Part 3 ("Recipe screen") and the Recipe and RecipeSteps boards.

**Blocked by:** 19

**Status:** open

- [ ] Moved first, in separate commits, web switched over with its unit tests: `use-system-conversion` (`useAutoConversion`), `use-amount-display-preference`.
- [ ] Sections in the board's order (Notes, Ingredients with tick and Add to groceries, Steps, rating, In cookbooks, Nutrition, Provenance, Source), Hidden Items respected.
- [ ] Servings, metric/imperial, favourite, plan, share, AI actions (when AI is on and permitted), delete with the native alert.
- [ ] Media: photo, gallery, video.
- [ ] Dish Colour tint; first frame from the Warm Set or a skeleton; writes through the Outbox.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
