# 07: The Draw icons round

**What to build:** On the Ingredients page, **Draw icons** opens a scope dialog modelled on Ask AI's. It offers two scopes:

- **Only foods with no icon at all**, the default, which skips foods that borrow one;
- **Every food without its own icon**.

Each scope shows how many icons it will draw, and starting it runs a background round that draws and sets them. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 05, 06

**Status:** done, pending gates and review

- [x] Scope counts cover the whole catalogue: only foods the person may edit, never the set's "drawn none" list. No price is shown.
- [x] The round is one job with one step per food, on its own queue (wired like the ingredient-review queue), and its worker is wrapped in `instrumentProcessor`.
  - [x] Foods the person can no longer edit are passed over.
  - [x] One food's failure is recorded on its step and does not end the round.
  - [x] Icons are set directly, with no review queue.
- [x] A running round shows its progress in the page header, as a running Ask AI round does. Its progress invalidates the icons query.
- [x] The button is hidden when the person can't draw or may edit no food in either scope. The server refuses likewise.
- [x] Translations in every locale.
- [x] Tests:
  - [x] the router at the tRPC caller (scope counts exclude the vague groups and foods the person can't edit; refused when it can't draw);
  - [x] the worker, following the ingredient-review worker tests.

## Comments

2026-10-06 (implementation): queue `ingredient-icons`, one step per food (`drawing-icon:3/12`), drawn one at a time (image APIs rate-limit hard, as for Generated Images). A food a person gave an icon of its own meanwhile is passed over too (`has-icon`), so a round never overwrites a person's choice. The round's progress is the `icons` broadcast; the page invalidates the icons read and its rows on each one, and the other surfaces refresh on the one `changed` the round announces when it ends. The scope counts load the whole catalogue in one read (about 6,000 rows on a seeded instance).
