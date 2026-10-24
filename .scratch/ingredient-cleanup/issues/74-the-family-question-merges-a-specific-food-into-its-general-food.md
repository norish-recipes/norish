# 74: The family question merges a specific food into its general food

**What to build:** Found by ticket 31's two runs after ticket 66 (2026-10-23, HEAD 9da73a9fc, `m74a_post_on` and `m74b_post_on`). Ticket 66's family question puts the parent first among the candidates, and the Decision or the match prompt answers "the name is this item" for a kind of it. The food is merged into its general food: Maris Piper potatoes into potato, genoa salami into salami, dried dill into dill, espresso into coffee preparation, warmgerookte zalm into smoked salmon, and in b italian sausage into sausage. Ticket 56's rule (a food is never merged into the parent AI gave it) guards only merges that AI's own names find, so these pass. Tickets 50 and 56 ruled that a more specific food is its own food under its general food.

On the copy: 51 merges in a and 54 in b (m70: 0 and 1), 31 foods in both runs (28 into the same food), 81 / 96 recipe lines. In b, 45 of the family question's 123 merges are this kind and 75 are right (near-duplicates such as plain Greek yogurt, white bread flour and kippengehakt). Ticket 31's count leaves the class out, so the crap total (57 / 52 against m70's 76 / 84) does not show it. Counted as wrong, it is 108 / 106 against 76 / 85.

To decide: does the family question ask only about the parent's kinds and leave the parent out (ticket 56's rule kept), or does it keep the parent, and are these merges accepted as the price of fewer near-duplicates?

**Blocked by:** None

**Status:** wontfix

## Wontfix (2026-10-23)

Ticket 66's family question is taken out, so this no longer happens.
