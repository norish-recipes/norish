# 23: AI drops a parent it does not share

**What to build:** When AI's pass reads a food as a food of its own and finds no general food for it, a parent the words gave it goes. Today the parent stays, unflagged, so a wrong one nothing ever shows remains: "peanut butter" under butter, "taco seasoning" under coating. Mike, 2026-10-20: agreed.

- **Only a parent no person chose:** the words', or an earlier AI Change's. A person's parent makes the food decided, so AI never asks about it.
- **An AI Change, with Undo:** a `parent` change to no parent, listed on Changed by AI ("No longer under butter"). Undo puts the parent back, and AI never drops it again.
- **Unsure too:** an unsure answer drops the parent and flags the food, as every unsure answer is applied and flagged.
- A general food AI names that the catalogue has still replaces the parent, as today.

**Blocked by:** None

**Status:** done

- [x] "peanut butter" filed under butter by its words, read by AI as a food of its own with no general food in the catalogue: no parent, listed on Changed by AI with Undo.
- [x] Undo puts butter back, and asked again, AI leaves it.
- [x] Unsure, the parent goes too and the food is flagged.
- [x] A food a person filed is never asked about, so its parent stays.
- [x] All `CONTRIBUTING.md` gates pass.

2026-10-20, implemented:

- `parentByAI(id, null, sure)` drops the parent. The change is a `parent` AI Change with no target, and its `formerParentId` is the dropped parent, so Undo puts that parent back. If the drop replaced an open guess, the parent restored is still the one the food had just before the drop. No migration was needed: a deleted target already cascades its change away, so a null target only ever means "no parent".
- `wasParentUndone(id, null)` remembers an undone drop, so AI does not drop again. Changed by AI shows "No longer under {of}" (`parentDropped`, in every locale). The pass reports `no-parent` with the parent it actually dropped in its transaction.
- A merge now moves a parent change's `formerParentId` too. That also affected plain parent changes, whose Undo went nowhere once their old parent had been merged away.
