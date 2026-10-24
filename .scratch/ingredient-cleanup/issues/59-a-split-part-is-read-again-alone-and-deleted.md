# 59: A split part is read again on its own and deleted

**What to build:** Found by ticket 31's run after ticket 56 (2026-10-22, HEAD 44297d433, `m56_post_on`). AI split a joined own food into two alternatives, sure, and named the second part right (written as a shortened name, English name "low-fat Greek yogurt", parent yogurt). The part's lookup asked the Decision (0.58) and the match prompt, which answered none, so the part became a new own food under its written words. The follow-up pass then read that new food by its written words alone, with none of the split's reading, answered not-a-food (gibberish, unsure), and deleted it (Mike's rule: not a food goes, sure or not).

On the copy: 1 food, 1 recipe line, now an "alternatives" line with one food.

To decide: does a part minted by a split keep the split's reading (English name, parent) instead of being asked again, or is it asked with the joined name it came from?

**Blocked by:** None

**Status:** needs-triage
