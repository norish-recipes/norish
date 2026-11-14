# 25: Grocery drag

**What to build:** Web's grocery drag on the shared drag list. See `.scratch/mobile-redesign/spec.md` Part 4 ("Grocery drag").

**Blocked by:** 19, 24

**Status:** open

- [ ] Moved first, in separate commits, web switched over with its unit tests: `dnd/drop-plan.ts` and the arranging logic of `use-list-dnd.ts`.
- [ ] Reorder within a Store, move to another Store or Unsorted, file into an Aisle (Aisle Link), a grouped line as one; store and recipe views.
- [ ] Drops go through the Outbox and converge with realtime.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
