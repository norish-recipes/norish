# 78: A broad native parent is taken before a specific English one

**What to build:** Found by ticket 31's final run (2026-10-23, HEAD 235ed6571, `m76_post_on`). The parent lookup tries `[...nativeParents, ...parents]`, so the native list's second, broader name finds a food before the English list's first, specific one is tried. A Dutch vegetable mix went under vegetable (vegetable blend in 0.25 and both m70 runs), Thai basil leaves under basil though seeded Thai basil exists, fine garden peas under pea (garden peas in both m70 runs), and gyoza wrappers under seeded casing through the native "vel".

On the copy: 4 foods, 7 recipe lines. Caused by ticket 76's order ("if both match we prefer native").

To decide: try the names by rank (first native, first English, second native, second English), or keep every native name first.

**Blocked by:** None

**Status:** needs-triage
