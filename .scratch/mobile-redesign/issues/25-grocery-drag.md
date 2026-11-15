# 25: Grocery drag

**What to build:** Web's grocery drag on the shared drag list. See `.scratch/mobile-redesign/spec.md` Part 4 ("Grocery drag").

**Blocked by:** 19, 24

**Status:** open

- [x] Moved first, in separate commits, web switched over with its unit tests: `dnd/drop-plan.ts` and the arranging logic of `use-list-dnd.ts`.
- [x] Reorder within a Store, move to another Store or Unsorted, file into an Aisle (Aisle Link), a grouped line as one; store and recipe views.
- [x] Drops go through the Outbox and converge with realtime.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: the ticket's names held. What moved to `packages/shared-react/src/groceries`, web switched, tests moved or added: `drop-plan.ts`; `utils.ts`, now `drop-containers.ts` with its types; from `use-list-dnd.ts` the key move (`moveKey`), the plan for a dragged key (`planListDrop`) and its writes (`writeDrop`); from `recipe-section.tsx` the by-recipe rule (`planRecipeReorder`); from `grocery-list.tsx` the by-Store lines (`groceriesByStore`). dnd-kit's own over/collision geometry stayed on web.
- Decided: `DragList` keeps the rows still under a lifted row and counts `from`/`to` in them; it shows a kept drop until `rows` changes, and `onDrop` returning false puts the row back. Mobile's `planStoreDrop` rebuilds the containers from the list as it is when the row lands and places the row after the nearest neighbour above that still exists, by id. A done row does not lift. Grocery reorders are sent one at a time (a mutation `scope`, as calendar plan writes do), so a second quick drop can't get ahead of the first and be refused as stale. A lifted row is its own rounded card with a shadow, tilted except under Reduce Motion. The board's 25% ghost, accent drop line and highlighted Aisle heading are not drawn, because the library moves the rows live instead.
- Simulator (iPhone 18 Pro, iOS 27.2, own server on :3400 with a throwaway Postgres and Valkey, light and dark): reorder within a Store; moves to another Store, to Unsorted and to an empty Store's heading; a drop under Meat & fish filed the Aisle Link, and the same item added again after a delete landed there; a two-source group moved as one, within its Store and to Unsorted; recipe view; a tap opens the edit sheet and the tick ticks; auto-scroll up and down, once the finger reaches the tab bar (holding over "Add items" does not scroll); Reduce Motion on; with the server stopped, a reorder and an Aisle drop survived a relaunch and were stored when it returned; a line added over the API while a row was held kept its place and the drop landed by id; a stale offline reorder was partly refused, the list went back to the server's order and the entry was parked (sign-out counted "1 change"). Not seen: the stale toast (gone before I looked), haptics, and the lifted card mid-drag (agent-device can't capture during a gesture). Android untested.
- For ticket 30: docs for dragging groceries (hold to lift, Aisle filing, recipe view reorders a recipe's lines only); no new strings.

