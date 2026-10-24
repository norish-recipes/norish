# 73: A parent AI names that finds nothing leaves the food without one

**What to build:** Found by ticket 31's same-code runs (2026-10-23, HEAD cce7f83de, `m70a_post_on` and `m70b_post_on`). With one judge, 23 listed own foods in both runs have no parent while the catalogue has an obvious one: the second-largest group after near-duplicates. Often AI names a parent or category the catalogue has under another wording ("spread", "seasoning"), so the lookup finds nothing and the food stays without a parent (ticket 53's shape).

**Blocked by:** 66 (shares its match question)

**Status:** wontfix (see Analysis)

## Decided (Mike, 2026-10-23)

"Yes all three and then we have to accept". First check on the 23 foods of m70a/m70b which candidates would have held the right parent; build the lean version of ticket 66's question for parents only if one candidate source covers most of them, otherwise record why and leave it. Measured twice against the m70 band like 66.

## Analysis (2026-10-23): no source covers most, nothing built

The 23 are each run's own (14 in both, 32 in all), from `v70a.json`/`v70b.json` (verdict `missing`), readings `r70a`/`r70b.jsonl`, the clones `m70a_post_on`/`m70b_post_on`, and the 0.25 parents from the 0.25 copy's export (`c025/cat025.txt`). The runs predate ticket 66's family question.

Why no parent came out (a / b):

- AI gave neither parent nor category: 6 / 5 (focaccia's, loempiavellen, papadums, ramen noodles, taco shells, whipped topping; b: rijstvellen, stevia instead of taco shells and whipped topping).
- AI named one and the lookup, slips included, found nothing: 15 / 17. The catalogue has it under another wording ("salad dressing" for dressing, "bun" for bread roll, "spice mix" for mixed spices, "bouillon cube" for broth) or in Dutch only (kipgehakt, zoete aardappel friet, ingelegde rode ui).
- Found, and a rule dropped it: 1 / 1. Category "sweetener" is an own food, and categories are looked up among seeded foods only (stevia in a, liquid sweetener in b).
- Has a parent, but too broad: 1 / 0 (unflavored protein powder under protein, where protein powder exists).

Obvious parents, as judged: dressing (balsamico, sinaasappel-chili), bread roll (bao buns, burger buns), bread (focaccia's), flatbread (papadums), beef (bone-in short ribs), dough or pastry (gyoza vellen, loempiavellen), mixed spices (harissa kruiden, mexicaanse kruiden, taco seasoningmix), herb (Italian herbs), condiment (mango chutney, sweet relish), nut (nut butter), zoete aardappel friet (ovenfriet zoete aardappel), broth (paddenstoelenbouillontablet, chicken bouillon cube), noodle (ramen noodles), sweetener (stevia, liquid sweetener), tortilla (taco shells), protein powder, whipped cream (whipped topping), ingelegde rode ui (zoetzure rode ui), vegetable or pickled cucumber (atjar tjampoer), kipgehakt (mager kipgehakt), curry (rendang), rice paper sheets (rijstvellen), sauce (tzatziki), cream cheese or dairy (zuivelspread).

Candidate sources: how many of the 23 the right parent is among (a / b):

| Source | a | b |
|---|---:|---:|
| (a) `findFood`'s slips on AI's parent or category name | 0 | 0 |
| (b) foods sharing a word with AI's parent or category name | 10 | 8 |
| (b) of those, among the first ten by shared words (ticket 66's cap) | 6 | 6 |
| (c) the parent the 0.25 copy had | 3 | 4 |
| (d) the family question (needs a found parent) | 1 | 0 |

- (a): the slips found nothing for any of them. The only finds are the two exact "sweetener" categories, blocked by the seeded-only rule on purpose (an own category may be a placeholder like "toppings").
- (b): the candidate lists hold 12 to 113 foods, mostly unrelated ("pear" and "slippery jack" for "bun", 36 foods for "spice mix", where mixed spices does not share the word "spice"). The right parent is among them in under half, and inside a ten-food cap in 6.
- (c): right for Italian herbs, ovenfriet zoete aardappel, zoetzure rode ui, chicken bouillon cube, mager kipgehakt, zuivelspread. Most 0.25 parents were wrong (pear, bone, butter, honey, chili pepper, balsamic vinegar) or missing.
- (d): it fires only where a parent is found. That is unflavored protein powder alone, whose family under protein holds protein powder.

No source reaches 60% (14 of 23); the best, (b), holds the right parent in 43% / 35%. Per the decision, nothing is built. A quarter of the 23 get no parent from AI at all, and no lookup fixes that.
