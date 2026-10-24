# 07: Cookbook members wait for the filters

**What to build:** A cookbook page asks for its members once, under the reader's stored filters.

- `app/(app)/cookbooks/[id]/cookbook-members.tsx` reads the filters without waiting for `isHydrated`, as `components/dashboard/library-view.tsx` does. So it fetches and shows the default list, then fetches again under the stored filters: a wrong list flashes and two requests go out.
- Wait as the Library does (the skeleton until the filters are read). With 05 the filters are there from the first render.

**Blocked by:** none.

**Status:** done

- [x] E2E: with stored filters, opening a cookbook makes one `cookbooks.recipes` request and never shows a member the filters leave out.

## Comments

- 2026-10-16, **done.** `cookbook-members.tsx` reads `isHydrated` and asks with `enabled: isHydrated`, drawing the skeleton until then, as `LibraryView` does. `first-paint.e2e.ts` stores Dinner-only filters in localStorage (no cookie, so the page has to read them after mount), opens a cookbook holding a Dinner and a Breakfast recipe, and checks that no card ever shows the Breakfast one and that exactly one `cookbooks.recipes` request goes out, under the stored filters. `library.list` is held for the scenario: the Cache Warmer reads the Library before any cookbook's members, so it never asks for them and every members request left is the page's own.
