# 77: A first parent that finds only a doubtful food ends the lookup

**What to build:** Found by ticket 31's final run (2026-10-23, HEAD 235ed6571, `m76_post_on`). `parentOf` takes the first of AI's parents that finds any food. When that find is only a slip and the second question rejects it, the lookup returns no parent and never tries AI's next parent. A jam brand's native parent "vruchtenjam" found fruit juice by a slip, the second question said no, and "jam" (an exact name, later in the list) was not tried. The food was under jam in both m70 runs; ticket 32's check fails.

On the copy: 1 food, 1 recipe line. Caused by ticket 76 (one parent before it, so there was no next one).

**Blocked by:** None

**Status:** needs-triage
