# 39: An other name AI gives merges into a different seeded food

**What to build:** Found by ticket 31's final run (2026-10-22, HEAD 0dab43bd8). With AI on, the pass merged 1 own food, sure, into a seeded food that is a different product: AI listed the seeded food's name among the food's other names, and an exact spelling of any of AI's names is taken without a second question (ticket 26). The English name and parent AI gave were right; only the other name crossed over to the neighbouring product.

- On the production copy: 1 sure merge, its recipe lines now on the other product, nothing flagged.
- To decide: whether an exact match found only through an other name (not the English name) is asked about, or made unsure, or whether the prompt says other names are synonyms of the same product only.

**Blocked by:** None

**Status:** wontfix

- [ ] A food is not merged, sure, into a different product found only by one of AI's other names.

## Closed (Mike, 2026-10-22)

"I think the soy sauce case is not that bad and might be right actually." No code.
