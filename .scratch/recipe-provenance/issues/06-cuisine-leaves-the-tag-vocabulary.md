# 06 — Cuisine leaves the Tag vocabulary

Status: ready-for-agent
Blocked by: 01 — Cuisine vocabulary and admin management; 04 — Cuisines on a recipe

Spec: `.scratch/recipe-provenance/spec.md`
Decision record: `docs/adr/recipes/0012-cuisines-are-curated-tags-are-not.md`

## What to build

Cuisine stops being recorded as a Tag. Auto-tagging no longer proposes cuisine Tags, and a one-time migration moves the cuisine Tags already stored onto the new vocabulary: recipes carrying a matched cuisine Tag gain the corresponding Cuisine, and the matched Tags are removed. After this ships, the fact lives in one place.

## Notes

**The migration must delete the orphaned `tags` rows, not just the join rows.** This is load-bearing rather than tidiness: under the `predefined_db` tag strategy the auto-tagging prompt injects every existing tag name back in as an allowed tag, so a surviving orphan row would keep cuisine in circulation after the migration meant to end it. Deployments carrying that strategy forward from the legacy `autoTaggingMode` setting are the ones at risk.

**Narrow the claim to what is actually true.** Cuisine leaves the *predefined* Tag vocabulary. It does not leave Tags altogether, and nothing should claim it does: free-form cuisine-like Tags a person typed — `sicilian`, `tex-mex`, `levantine` — are folksonomy and stay. Only Tags that match the seeded vocabulary are touched. Tags are an open dumping ground by design, which is exactly why cuisine needed somewhere else to live.

The migration records what it removed per recipe, because the removal is not reversible from within the application.

Tags overlapping the meal-time categories is accepted as-is and explicitly not addressed here.

## Acceptance criteria

- [ ] The auto-tagging prompt no longer contains cuisine entries.
- [ ] A one-time migration attaches the corresponding Cuisine to every recipe holding a matched cuisine Tag.
- [ ] The migration removes both the join rows and the now-orphaned tag rows for matched cuisine Tags.
- [ ] Unmatched Tags survive untouched, including free-form cuisine-like Tags outside the seeded vocabulary.
- [ ] Recipes with no cuisine Tags are unaffected.
- [ ] The migration records what it removed per recipe.
- [ ] Re-running the migration is a no-op.
- [ ] Under the `predefined_db` tag strategy, migrated cuisine names are no longer offered back to the auto-tagging prompt.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Removing the deprecated auto-tagging configuration fields, which remain the upgrade path for deployments on the current release.
- Removing the duplication between Tags and the meal-time categories.
- Reclassifying free-form cuisine-like Tags that are not in the seeded vocabulary.
