# 45: A split part AI found nothing for takes no slip

**What to build:** Found by the audit of ticket 31's final run (2026-10-22, `m31c_post_on`; ticket 41 names it). "vegatine of agar agar" was split, and its "agar agar" part ended up on barley.

**The path.** AI read the food as two alternatives. For "agar agar", AI's names found no exact spelling, only slips; the second question (Decision) answered none of them (0.98). So `askWhatFoodThisIs` handed the part over with `found: null`. Then:

- `split()` in `review.ts` resolves every part without a found food through `resolveParts(…, { userId: food.ownerId })`;
- `resolveParts` calls `resolveIngredients(texts, actor)` with no options;
- `resolveTexts` (`resolver.ts`) runs the import's rung 3, `findSlips(options.mint === false ? [] : unknown)`, and `onlyNearest` took barley's Basque spelling "garagar".

So the slip AI had just refused was taken anyway, unasked. Ticket 26's rule is that in AI's pass a slip is only taken through the second question.

**Fix (Mike, 2026-10-22):** a part AI's names found nothing for becomes a food of its own: rungs 1–2, else a mint, never a slip. AI's pass reads that mint next, as it reads every mint (`announceMinted`).

- `ResolveOptions` gets `slips?: boolean`. When it is off, `resolveTexts` skips `findSlips`. `resolveParts` takes the options and passes them on, and `split()` passes `{ slips: false }`.
- A part the second question picked a slip for is never `sure` (`isExact`), so today it also reaches `resolveParts` as text, where it takes the nearest slip by itself. Hand the part the food AI picked (`found: found.food`, not only when sure), so it keeps AI's pick and not a mint.
- The import's own `resolveParts` call (`recipe-lines.ts`, the texts the import's AI named) keeps rung 3 unchanged.

**Blocked by:** None

**Status:** done

- [x] "vegatine of agar agar", whose "agar agar" only finds the slip "garagar" and the second question answers none, splits into vegatine and a new food "agar agar", which AI's pass is asked about. Barley is unchanged.
- [x] A part whose slip the second question picks is still split onto that food.
- [x] An import line that is a slip of a known food still takes that food (rung 3).

## Implemented (2026-10-22)

- `ResolveOptions.slips?: boolean` (`resolver.ts`): off, `resolveTexts` passes no spelling to `findSlips`, so a text rungs 1-2 miss is minted. `resolveParts(parts, actor, options = {})` passes the options on; `split()` (`review.ts`) passes `{ slips: false }`. The import's `resolveParts` in `recipe-lines.ts` passes none and keeps rung 3 (covered by `resolver-ai.test.ts` "takes the known food a text is a slip of").
- `readThenLookUp` (`ingredient-resolution.ts`) hands every part `found: found.food`, sure or not, so a part whose slip the second question picked lands on that pick (by the matched spelling's alias; the part's own text is not added as a spelling, as for an exact find). A part found nothing for, or answered none, goes to `resolveParts` as text and is minted, flagged `ai-queued` and announced, so AI's pass reads it next.
- No version bump: `CLEANUP_VERSION` 4, `RUNG_VERSION` 10, `SEED_CORRECTIONS_VERSION` 3 unchanged (the split is AI's pass, not a startup step).
- Tests: `review.test.ts` "a part AI's names find only a slip for" (red first: "agar agar" landed on barley via "garagar"): answered none mints "agar agar", announced, barley keeps only its spellings; a picked slip splits onto barley.
- Release notes: the 0.26 slip line now says AI picks one or none "for a parent and each part of a split too".
