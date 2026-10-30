# 55: A language model's sure pick overrides a Decision that doubted it

**What to build:** Found by ticket 31's run after tickets 50 and 54 (2026-10-22, HEAD c93158c4f, `m54_post_on`). When only a slip finds a food, the second question asks the Decision first. Under `RESOLUTION_THRESHOLD`, `decideFood` returns nothing and `askLanguageModel` asks again. Since ticket 54, that answer's own `sure` makes the merge sure (`sureOfSlip: answer.sure`), so a pick the Decision doubted lands with no flag.

- On the production copy: 10 language-model picks after a doubting Decision (0.47 to 0.72). 5 became sure merges: 3 read right, 2 are a narrower product merged into its general seeded food (Decision 0.68 and 0.55). One more own food followed one of them by an other name. 3 foods, 5 recipe lines, all unflagged.
- The Decision's own sure picks (0.9 or more) were all right in this run, and its slip picks at 0.85 and 0.87 stayed unsure, flagged, as ticket 54 meant.
- To decide: is a language-model pick after a doubting Decision ever sure, or does `sureOfSlip` hold only for a Decision at 0.9 or more (and for the language model only when the Decision is off)?

**Blocked by:** None

**Status:** needs-triage
