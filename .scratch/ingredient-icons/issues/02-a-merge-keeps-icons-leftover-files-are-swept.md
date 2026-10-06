# 02: A merge keeps icons; leftover icon files are swept

**What to build:** Merging two Ingredients loses no icon. The surviving food keeps its own icon, or takes the merged-away food's when it has none. Icon files that nothing points at are cleaned up by the scheduled tasks: a draft that was never saved, or an icon that was removed or replaced. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A merge coalesces the own icon onto the target, the target's winning, beside the existing `off_id` coalesce.
- [ ] A scheduled task removes own-icon files that no Ingredient references. A file younger than a grace period is kept, so an open draft's upload survives until Save.
- [ ] The task is registered like every scheduled task, and its worker is wrapped in `instrumentProcessor`.
- [ ] Tests: the merge both ways against a real database, and the sweep keeping referenced and recent files while removing the rest.
