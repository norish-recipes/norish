# 01: An explicit sort beats rank

**What to build:** Make a chosen sort order the results while searching. Today `listLibrary` orders by `rank DESC` before `LIBRARY_ORDER_BY[sortMode]` (`packages/db/src/repositories/library.ts:230-241`), so "Newest" barely changes a search. **Best match** is the existing `sortMode: "none"`: rank when there is text, newest otherwise.

**Blocked by:** none

**Status:** done

**Decided (2026-11-19):** the rule is opt-in, so web keeps its look and behaviour. Giving web Best match as its default would un-highlight its Date sort button, which Mike ruled out. `library.list` takes an optional flag (default off) that mobile Search sends; with it, an explicit sort replaces rank, and `none` still means rank when there is text, newest otherwise. Without it, ordering is exactly today's.

- [x] Repository tests first: with the flag, text and `none` follow rank, and text with `dateDesc`/`dateAsc`/`titleAsc`/`titleDesc` follows that sort; without the flag, ordering is unchanged; Pantry-only still orders by pantry coverage first either way.
- [x] The flag on the `library.list` input and the ordering in `listLibrary`; web sends nothing new.
- [x] Gates green.

## Comments
Flag is `sortBeatsRank` (boolean, default false) on `library.list` and `LibraryListParams`; web sends nothing.
With it and a sort other than `none`, rank and the cookbook pin drop out of the ORDER BY (text-matching cookbooks no longer pin); `none` still ranks.
Pantry coverage stays first either way. Unflagged ordering is untouched; its test only asserts the best match leads, since equal ranks tie-break by the sort.
No deviations; nothing left undone.

Review (2026-11-19), range `c82bd4310..72b67a0e0`:
- fixed: the ordering condition is named `relevanceFirst` (`46599c0e3`); the fixture comment uses the recipes' names; each flagged sort's expected order now differs from rank-first, proven by breaking the code; the unflagged test asserts the full order for every sort (`72b67a0e0`).
- rejected: "the flag is unused" and "mobile opt-in is pending": ticket 02 sends it. "The cookbook pin drops with the flag and an explicit sort": Search asks for recipes only, so nothing reads that order.
