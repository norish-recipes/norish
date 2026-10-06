# 07: The Draw icons round

**What to build:** On the Ingredients page, **Draw icons** opens a scope dialog modelled on Ask AI's. It offers two scopes:

- **Only foods with no icon at all**, the default, which skips foods that borrow one;
- **Every food without its own icon**.

Each scope shows how many icons it will draw, and starting it runs a background round that draws and sets them. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 05, 06

**Status:** ready-for-agent

- [ ] Scope counts cover the whole catalogue: only foods the person may edit, never the set's "drawn none" list. No price is shown.
- [ ] The round is one job with one step per food, on its own queue (wired like the ingredient-review queue), and its worker is wrapped in `instrumentProcessor`.
  - [ ] Foods the person can no longer edit are passed over.
  - [ ] One food's failure is recorded on its step and does not end the round.
  - [ ] Icons are set directly, with no review queue.
- [ ] A running round shows its progress in the page header, as a running Ask AI round does. Its progress invalidates the icons query.
- [ ] The button is hidden when the person can't draw or may edit no food in either scope. The server refuses likewise.
- [ ] Translations in every locale.
- [ ] Tests:
  - [ ] the router at the tRPC caller (scope counts exclude the vague groups and foods the person can't edit; refused when it can't draw);
  - [ ] the worker, following the ingredient-review worker tests.
