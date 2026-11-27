# 04: The household's grocery names

**What to build:** A read of the names the household has added and still keeps, ordered for Completions, available offline. See the spec, "Candidates and order".

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] **Read:** a `groceries.names` query through the groceries repository: every kept grocery of the household (archived, done and open, however it was added), one entry per folded name with its newest spelling, ordered by how often it was added, then by its newest add.
- [ ] **Open names:** names still open on the list are left out on the client, from the list it already holds, so the read is not refetched on every tick.
- [ ] **Fresh and offline:** the read is invalidated when groceries are added or removed, including by another member, and is in the offline warm set (`packages/shared-react/src/offline/warm-set.ts`).
- [ ] **Hook:** a `packages/shared-react` hook both apps use, feeding the match rule (ticket 03) from the name `useParsedGroceryName` returns.
- [ ] **Tests:** order by count then recency, newest spelling wins, a second household's names never appear, an open name is skipped.
