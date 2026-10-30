# 79: AI's parents leave out the general food

**What to build:** Found by ticket 31's final run (2026-10-23, HEAD 235ed6571, `m76_post_on`). Asked for two or three parents, most specific first, AI gives only specific wordings for some foods, and none of them is in the catalogue: "bouillon cube" and "stock cube" for bouillon cubes, "cream cheese alternative" for a dairy-free cream cheese, "pie filling" for a cherry pie filling. The food then loses the right parent it had: broth, cream cheese, cherry. In m70a, m70b, m74a and m74b AI's one parent for the bouillon cubes was broth every time.

On the copy: 4 foods, 10 recipe lines; 3 count as missing a parent. Caused by ticket 76's parents field.

To decide: the field's description asks for the broad base food as the last wording, or a current parent stays when none of AI's parents finds a food.

**Blocked by:** None

**Status:** needs-triage
