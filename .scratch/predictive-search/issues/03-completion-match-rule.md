# 03: The Completion match rule

**What to build:** One pure function in `packages/shared` that every field uses: given the typed text and ordered candidates, it returns up to three Completions and the ghost text. See the spec, "Matching".

**Blocked by:** none

**Status:** ready-for-agent

- [ ] **Tiers:** word start; one slip from a word start (from 5 letters, never the first, reusing `packages/shared/src/lib/name-slips.ts`); inside a word (from 3 letters). Higher tiers first, top three offered, candidate order kept within a tier.
- [ ] **Ghost text:** the best word-start Completion; where one continues another, the shorter one.
- [ ] **Fill text:** typed characters keep their casing, the rest is the candidate's from the matched word on.
- [ ] **Duplicates:** candidates whose folded text is the same are offered once.
- [ ] **Tests:** "tikka m", "masala", "chikcen", "ikka", "oli" (olive oil before broccoli), "tik" with "tikka" and "tikka masala", typed casing kept, nothing under the letter minimums.
