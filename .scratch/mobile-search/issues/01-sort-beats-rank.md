# 01: An explicit sort beats rank

**What to build:** Make a chosen sort order the results while searching. Today `listLibrary` orders by `rank DESC` before `LIBRARY_ORDER_BY[sortMode]` (`packages/db/src/repositories/library.ts:230-241`), so "Newest" barely changes a search. **Best match** is the existing `sortMode: "none"`: rank when there is text, newest otherwise.

**Blocked by:** none

**Status:** ready-for-agent

**Decided (2026-11-19):** the rule is opt-in, so web keeps its look and behaviour. Giving web Best match as its default would un-highlight its Date sort button, which Mike ruled out. `library.list` takes an optional flag (default off) that mobile Search sends; with it, an explicit sort replaces rank, and `none` still means rank when there is text, newest otherwise. Without it, ordering is exactly today's.

- [ ] Repository tests first: with the flag, text and `none` follow rank, and text with `dateDesc`/`dateAsc`/`titleAsc`/`titleDesc` follows that sort; without the flag, ordering is unchanged; Pantry-only still orders by pantry coverage first either way.
- [ ] The flag on the `library.list` input and the ordering in `listLibrary`; web sends nothing new.
- [ ] Gates green.

## Comments
