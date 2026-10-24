# 04: Groceries, pantry, calendar and today's meals skeletons

**What to build:** Each of these shows one Skeleton in today's shape.

- **Groceries:** drawn once, below the header. The `loading.tsx` above the header goes. No `p-6` wrapper; rows are `px-4 sm:pl-10`. Store headings stay; aisle headings are drawn when the reader's grouping shows them. Icons and the price column follow the page.
- **Pantry:** its own skeleton, with the search field, instead of the grocery list's.
- **Calendar:** phone days are cards with the real day header and no items (a day's meals are optional). Desktop cards use `px-4 py-3` and the real thumbnail size.
- **Today's meals:** draws the slots the reader's visibility setting keeps, and nothing when that setting can hide the whole row.
- `groceries-skeleton.tsx` is deleted.
- Real words: headings and labels render through translations.

See `.scratch/skeletons-and-page-loads/spec.md`, Skeletons.

**Blocked by:** None. The view-transitions work in the checkout touches the groceries layout and is committed first.

**Status:** done

- [x] Each skeleton matches its page, checked side by side in a browser on both Device Kinds.
- [x] A client navigation to groceries shows one skeleton.
- [x] Existing tests that assert skeleton markup are updated; `first-paint.e2e.ts` stays green.

**Done 2026-10-15** (`8ee3db13c`): `groceries/loading.tsx` and `groceries-skeleton.tsx` deleted; grouped rows carry the drag handle in line, flat rows in their padding; the price column and aisle headings are left out: only linked rows have a price, and a store's unfiled rows come before its first aisle (if it has any), so a placeholder heading would move or vanish. Today's meals under the planned rule draws nothing while loading, and `first-paint.e2e.ts` now expects no block in the server markup.
