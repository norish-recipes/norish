# 08: The server draws a cookbook's members

**What to build:** A full load of a cookbook shows its members, not only its header, in the first paint.

- Seed `cookbooks.recipes` (infinite) with `cookbookRecipesInput(id, filters)` under 05's filters in `app/(app)/cookbooks/[id]/layout.tsx`, beside `cookbooks.get`. No shell provider watches that key.
- The member grid gets 06's `initialRect` from Device Kind.

**Blocked by:** 01, 05, 06, 07.

**Status:** done

- [x] `first-paint.e2e.ts`: a cookbook's server markup carries a member's card.
- [x] 01's harness, a cookbook: before and after.

## Comments

- 2026-10-17, **done.** `cookbooks/[id]/layout.tsx` reads `cookbooks.recipes` (infinite) with `cookbookRecipesInput(id, …)` under 05's filters beside `cookbooks.get`; `cookbookRecipesInput` moved into the filter contract so the server can import it. The member grid is 06's `LibraryGrid`, with its `initialRect`. `first-paint.e2e.ts` finds a member's card in the server's markup.

  | Cookbook (ms)  | Before               | After          |
  | -------------- | -------------------- | -------------- |
  | first paint    | 648 (616–708)        | 656 (632–816)  |
  | first member   | 6,655 (6,526–7,081)  | 656 (632–816)  |
  | document       | 33.1 KB gzip         | 39.0 KB gzip   |
