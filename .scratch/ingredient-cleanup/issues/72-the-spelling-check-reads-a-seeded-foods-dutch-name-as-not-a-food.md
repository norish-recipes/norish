# 72: The spelling check reads a seeded food's Dutch name as not a food

**What to build:** Found by ticket 31's run after tickets 51-53, 65, 67, 68 and ticket 60's round 2 (2026-10-23, HEAD 814c23937, `m68_post_on`). The spelling check read the Dutch name of a seed ("Papaver" on poppy) as not a food and removed it, sure, so its one recipe line, which is just that word, now names no food and the spelling is on the junk pile. The four runs before (m54, m56, m60, m64) kept it. The only difference is ticket 51's line under the spelling, which here repeats the spelling.

On the copy: 1 spelling, 1 recipe line.

To decide: run variance left alone, or a "not a food" for a spelling whose line is the spelling alone needs AI to be sure in a second question.

**Blocked by:** None

**Status:** wontfix

## Decided (Mike, 2026-10-23)

Left alone: one food or line in one run. Mike and the orchestrator agreed (2026-10-23) to stop adding rules for single-food findings that may be run-to-run variance, and to first measure that variance (ticket 31) and the near-duplicate gap since m54.
