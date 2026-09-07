# 03 — Filing by drag

Status: ready-for-agent
Blocked by: 02

Spec: `.scratch/grocery-aisles/spec.md` · Decision: ADR-0031

## What to build

A shopper drags a row into an aisle of its own Store and the name is filed there; drags it back into the unfiled area at the top of the block and the name is forgotten; drags it into another Store, into its unfiled area or straight into one of its aisles, and the grocery is assigned to that Store and then filed there, in that order, so the grocery sits under the Store before its name is taught to it. In the grouped view, dragging a group files every distinct name in it. Rows keep their per-Store sort order, and within an aisle follow it, so reordering inside an aisle still works.

The drag container model gains a level: a droppable per aisle inside each Store block, and the unfiled area as the Store's own container, in both the flat and the grouped providers. Filing and reordering stay two separate mutations, each idempotent, each through the optimistic and outbox path. The store-level drop target the E2E already addresses keeps its attribute; aisle drop targets get one of their own.

## Notes

- Every aisle renders always (ticket 01), so a drop target exists for an empty aisle without any drag-time layout change.
- Prior art: the grocery DnD providers, the reorder-in-store procedure that already assigns a Store on drop, and the drag helper in the grocery prices E2E.
- Known hazard: menus whose items derive from state their own action mutates can re-render mid-exit and steal focus; keep the drop handlers free of that pattern.

## Acceptance criteria

- [ ] Dropping a row into an aisle of its Store files the name; dropping it into the unfiled area forgets it; sort order within the aisle is kept.
- [ ] Dropping a row into another Store's aisle assigns the Store and then files; dropping into another Store's unfiled area assigns only.
- [ ] Dragging a group files every distinct name in the group.
- [ ] Same-named rows follow a drag on every household screen.
- [ ] E2E: drag a row into an aisle and see its sibling follow; drag it back to the top and see both unfile; drag a row into another Store's aisle and see it there.
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm test:e2e` and `pnpm build` pass.
