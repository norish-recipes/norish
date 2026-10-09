# Ingredient Nutrition coverage without AI: how high can it go?

Researched 2026-10-01, as a follow-up to `research.md`. Markers: **[V]** measured by a script over the downloaded files, or hand-checked by me on the sample stated. **[I]** inferred or estimated, with the reasoning given. The "Method" section at the end says how to reproduce every number. The scripts are in my session scratchpad, not the repo.

**Definitions used throughout.**

- An entry is **covered** when it gets kcal, protein, carbohydrate and fat per 100 g, all four present. "Traces" counts as 0 and "< x" as x/2.
- **Own** means the entry's own code or name produced the numbers. **Borrowed** means they came from the nearest ancestor that has numbers of its own.
- **Usage-weighted** means weighted by how many of the 56,498 recipes in Ahn et al. 2011 mention the ingredient (see "Usage weighting").

## Bottom line

- **Baseline reproduced, but it is 66.8%, not 70%.** [V] OFF's lookup order gives 3,962 entries (69.5%) whose inherited CIQUAL code resolves to a row, which matches `research.md`. But 154 of those land on a row with no energy value. Examples are CIQUAL 2020 codes that 2025 dropped, such as 13050 "Apple, pulp, raw" and 20504 "Lentil, dried". So **3,808 entries (66.8%) actually get all four macros**. Only **976 (17.1%)** of those numbers are the entry's own. Usage-weighted, the baseline already covers **91.0%** of recipe mentions, **76.7%** with own numbers.
- **Best measured with no AI: 4,449 entries (78.1%), 1,872 with own numbers (32.8%). Usage-weighted that is 95.6% covered and 93.3% own.** [V] Hand-checking the value of every recipe-used ingredient puts the share that is both covered and plausibly correct at about **90%** of recipe mentions. About 5.4% of mentions get a wrong value, almost all from codes OFF assigned on the taxonomy, not from Norish's levers. [V hand check, see the "Usage-weighted correctness" section]
- **What each lever adds, in order:**
  1. **Look up the entry's own code before an ancestor's.** OFF does the reverse: an inherited `ciqual_food_code` beats the entry's own `ciqual_proxy_food_code`. Fixing the order adds +50 entries, but it is mostly a correctness fix. Usage-weighted own coverage goes from 76.7% to 86.0%: cinnamon, ginger, basil, thyme, oregano and coriander stop getting "Spice/Herbs (average)", and white wine stops being pure alcohol at 660 kcal. No new data; a code-only change.
  2. **CALNUT**, ANSES's gap-filled CIQUAL: +95 entries. It has the same licence as CIQUAL, and OFF already vendors it.
  3. **Other CIQUAL-keyed taxonomy properties**: +27.
  4. **USDA codes already on the taxonomy**: +258 entries, and +504 entries with own numbers. CC0.
  5. **CNF joined through USDA codes**: +0.
  6. **Deterministic name matching** (exact plus normalised): +189 entries, +232 with own numbers. On a 50-match hand-checked sample, precision was 50/50.
  7. **Categories-taxonomy bridge**: +22 entries, +89 with own numbers.
  8. **Rejected:** a fuzzy rung (57% precision) and a "head noun" rung (75% precision). [V]
- **The ceiling for raw entries is near 80%, and that is fine.** Of the 1,250 entries still uncovered, about 690 are not cooking foods [I, rule-based]: flavourings, wine-grape varieties, ferments and enzymes, fibres and isolates, industrial preparations. Another 72 are group nodes (`en:vegetable`, `en:meat`). Usage-weighted, the whole remainder is **4.4% of recipe mentions**, and about ten entries carry most of it: beef, cumin, pork, beans, vegetable, seed, meat, milkfat, lamb, black bean and kidney bean. [V]
- **Inheritance quality is about the lender, not the distance.** I tested it leave-one-out: every entry with numbers of its own was asked what it would borrow if it had none. 22% of those borrows are off by more than 50 kcal *and* more than 30%. The rate barely changes with distance (22% at one level, 25% at two). It is concentrated in a few lenders: `en:sauce` 100%, `en:alcohol` 94%, `en:beef-meat` 59%, `en:cream` 50%. [V] Blocking the ten worst lenders costs 104 entries (78.1% → 76.2%) and cuts the estimated number of bad borrows from about 620 to 533. "Parent only" costs 547 entries for less gain. [V coverage; I for the bad-borrow estimate]
- **Borrowing barely matters for what recipes use.** With no borrowing at all, the best configuration still covers **93.3%** of recipe mentions, against 95.6% with borrowing. [V] Borrowing is what lifts raw-entry coverage from 33% to 78%, but those are mostly entries recipes rarely name.
- **Cheapest route past about 90% correct recipe mentions** is a small hand-curated override list (≈25–30 entries) for the most-used gaps and wrong codes, or the same fixes upstreamed to the OFF taxonomy. Examples: beef, pork, lamb, cumin, beans and kidney beans as gaps; milk = skimmed, corn = dry grain, chicken broth = raw chicken, beef broth = dehydrated stock, hot sauce = 246 kcal, and pistachio = macadamia as wrong codes. I estimate that takes plausible usage-weighted coverage to about 98–99%. [I: it is the sum of the mention counts listed in the "Leftover" and "Usage-weighted correctness" sections]

## Summary table

The levers are cumulative, in the order applied. "Gained" is the change in entries covered, with the change in entries holding *own* numbers in brackets. Usage-weighted columns are shares of the 460,582 Ahn ingredient mentions that map to a taxonomy entry.

| # | Lever | Entries gained (own) | Cumulative coverage | Own numbers | Usage-weighted covered / own | Precision | Licence | Effort |
|---|---|---|---|---|---|---|---|---|
| 0 | OFF baseline: inherited `ciqual_food_code`, else inherited proxy; DFS; rows with all four macros | n/a | 3,808 (66.8%) [3,962 resolve] | 976 | 91.0% / 76.7% | n/a | Etalab LO 2.0 | none (`research.md` option A) |
| 0a | *Reference:* `ciqual_food_code` only, no proxies | −851 vs #1 | 3,007 (52.8%) | 879 | 58.9% / 45.8% | n/a | | proxies are worth +851 entries and +32 pts of usage |
| 1 | Own code or proxy first, then the nearest ancestor (BFS) | +50 (+43) | 3,858 (67.7%) | 1,019 | 91.3% / **86.0%** | changes the value of 144 entries, 34 of them by a lot | same | trivial (lookup order) |
| 1b | CALNUT 2020 fills missing energy | +95 (+25) | 3,953 (69.4%) | 1,044 | 93.1% / 88.0% | ANSES's imputation, flagged by ANSES as below CIQUAL's usual quality criteria | same as CIQUAL [V README] | one 3 MB CSV, already in OFF's repo |
| 1c | Other CIQUAL-keyed properties (`ciqual_food_2/3_code`, `agribalyse_*`, typo variants) | +27 (+3) | 3,980 (69.8%) | 1,047 | 93.9% / 88.8% | some are odd (`ciqual_proxy_proxy_food_code` maps celery to celeriac), so try them after USDA | same | trivial |
| 2 | USDA SR Legacy + Foundation via `usda_ndb_code`, `usda_fdc_code`, proxies, `_2`/`_3` | **+258 (+504)** | 4,238 (74.4%) | 1,551 | 94.4% / 91.2% | taxonomy USDA codes disagree with the same entry's CIQUAL code in 25 of 296 entries (8%) | CC0 | 6 MB + 3.7 MB zips |
| 3 | Canadian Nutrient File via `USDA_NDB_Code` | +0 (+0) | n/a | n/a | n/a | n/a | OGL-Canada | not worth it: every NDB code already resolves in SR Legacy |
| 4a | Name match, exact (folded) | +6 (+32) | 4,244 (74.5%) | 1,583 | 94.4% / 91.4% | see 4b | per source | |
| 4b | Name match, normalised | +183 (+200) | 4,427 (77.7%) | 1,783 | 95.6% / 93.1% | **50/50** on the sample of matches that change an entry; 59/60 on an earlier random sample of all matches (the one miss was fixed by keeping "whole") | CIQUAL LO, USDA CC0, CoFID OGL v3, CNF OGL-Canada | moderate: about 150 lines plus a review list. Uses CoFID (4.4 MB) and CNF names + nutrient_amount (22 MB) |
| 4c | *Rejected:* fuzzy rung (difflib ≥ 0.92) | +24 | 4,451 | 1,806 | 95.6% / 93.4% | **21/37 = 57%** (cinnamon→canelé, flour T550→T55, pomelo juice→apple juice) | | |
| 4d | *Rejected:* "head noun" rung (name = first comma segment) | +41 (+88) | n/a | n/a | +1.2 pts covered | **30/40 = 75%** (beans→mung beans, citron→lemon, truffle→chocolate truffle) | | |
| 5 | Categories-taxonomy bridge: exact shared en/fr name with a CIQUAL-coded category | +22 (+89) | **4,449 (78.1%)** | **1,872** | **95.6% / 93.3%** | about 27/30 plausible on a hand-checked sample; 3 ambiguous (instant mashed potato 68 kcal as prepared, compote 107 kcal as sweetened, passata 46 kcal) | ODbL (OFF) + CIQUAL | categories.txt (3.6 MB); small code |
| 6a | Rule: block the 10 lenders with leave-one-out bad rate ≥ 50% | −104 | 4,345 (76.2%) | 1,872 | 95.1% / 93.3% | estimated bad borrows 620 → 533 [I] | | trivial |
| 6b | Rule: borrow from the parent only (distance 1) | −547 | 3,902 (68.5%) | 1,872 | 95.4% / 93.3% | estimated bad borrows 620 → 488 [I] | | trivial |
| 6c | Rule: no borrow when the child adds a "form word" the lender lacks (broth, oil, juice, powder, dried, …) | −519 | 3,930 (69.0%) | 1,872 | 94.8% / 93.3% | leave-one-out bad rate 34% with a form word vs 19% without; estimated bad borrows 620 → 497 [I] | | small |
| 6d | No borrowing at all | −2,577 | 1,872 (32.8%) | 1,872 | **93.3% / 93.3%** | 0 bad borrows | | trivial |

Not measured: Frida (Danish names, no join key), IFCT (119 taxonomy entries carry `ifct_food_code`; at most +10 entries and 31 upgrades; licence of IFCT 2017 not checked), and NEVO (excluded on licence, see `research.md`).

## Usage weighting

- **Public source (used for every "usage-weighted" figure)** [V]: Ahn, Ahnert, Bagrow & Barabási, "Flavor network and the principles of food pairing", *Scientific Reports* 1, 196 (2011), doi:10.1038/srep00196, supplementary data 3 (`srep00196-s3.csv`). It holds 56,498 recipes from allrecipes.com, epicurious.com and menupan.com, with 381 normalised ingredient names and 464,407 recipe-ingredient mentions. I counted the recipes that mention each ingredient. The file came from `static-content.springer.com/esm/art%3A10.1038%2Fsrep00196/MediaObjects/41598_2011_BFsrep00196_MOESM3_ESM.zip`.
- **Mapping to taxonomy ids** [V method; I for overrides]:
  - Matched automatically against the taxonomy's English names (folded, singular): 308 of 381 names, 98.4% of mentions.
  - Plus 14 hand overrides for Ahn's normalisation quirks: `wheat`→`en:wheat-flour`, `cane_molasses`→`en:sugar` (Ahn folds sugar into cane molasses), `vanilla`→`en:vanilla-extract`, `tabasco_pepper`→`en:hot-sauce`, and similar.
  - Result: **460,582 mentions (99.2%) over 307 taxonomy ids**.
- **Bias** [I]: the source is US/Korean recipe sites from around 2011, and it is coarse (one "cheese", one "fish"). That over-weights generic, well-coded staples and under-weights niche or European entries. Treat the usage-weighted numbers as "the staples are covered", not as a promise for any household.
- **Local Norish dev database (also checked, read-only)** [V]:
  - `norish-db-local` on :5432 holds 5 recipes and 57 recipe lines.
  - Only 17 lines resolve to a seeded Ingredient (one with `off_id`). All 17 are covered at the baseline and at every step.
  - The other 40 lines point at minted Ingredients with no `off_id`, and only 1 has a parent (Madras curry powder → `en:curry-powder`). Examples: "milde olijfolie", "verse peterselie", "ground cumin".
  - The sample is far too small to weight by. It still points at a separate gap, see Open question 1.

## Per-lever detail

### Step 0: reproducing the baseline [V]

`baseline.py` mirrors OFF's `NutritionEstimation.pm`:

- `get_inherited_property(ciqual_food_code) // get_inherited_property(ciqual_proxy_food_code)`
- Inheritance is depth-first, first parent first.
- CIQUAL 2025, with the 2020 table filling codes 2025 dropped.

| Measure | Entries |
|---|---|
| Code resolves | **3,962 (69.5%)**, matching `research.md` |
| Row has all four macros | **3,808 (66.8%)** |
| Number is the entry's own | 976 |

The 154 missing are rows with an empty energy column. The biggest lenders among them:

| Code | CIQUAL row | Borrowers |
|---|---|---|
| 13050 | Apple, pulp, raw | 31 |
| 13997 | Red berries | 25 |
| 20504 | Lentil, dried | 22 |
| 13112 | Grape, raw | 14 |
| 31089 | Agave syrup | 9 |

In the vendored 2020 table, 888 of 3,186 rows have no EU-regulation energy value; in the 2025 table, 143 of 3,484 do. [V]

### Lever 1: proxies and lookup order [V]

- **Proxies are already in the baseline, and they matter a lot.** With `ciqual_food_code` alone, coverage is 3,007 (52.8%), and usage-weighted coverage is only 58.9%. Proxies carry milk, wheat flour, butter, olive oil, sugar, cinnamon and most spices.
- **OFF's order lets an ancestor's code beat the entry's own proxy.** 44 entries carry their own proxy but get an ancestor's code instead:
  - `en:white-wine` own proxy 5215 "Wine, white, dry" → takes `en:alcohol`'s 1014 "Pure alcohol" (660 kcal)
  - `en:olive-oil` 17270 → "Vegetable oil (average)"
  - `en:orange-juice` → "Fruit juice (average)"
  - `en:petit-suisse` → "Cheese (average)"
  - and cinnamon, ginger, basil, thyme, oregano, rosemary, sage, coriander and turmeric → "Spice/Herbs (average)"

  These are among the most-used ingredients, so own-first raises usage-weighted own coverage from 76.7% to 86.0%. Over all entries, the order change alters the value of 144 entries, 34 of them by more than 50 kcal and 30%.
- **Nearest-ancestor BFS instead of DFS.** When the nearest ancestor's row has no energy, BFS keeps looking. That accounts for most of the +50 coverage.
- **Other nutrition-bearing properties** [V counts from the property census]:
  - `ciqual_food_2_code` (8), `ciqual_food_3_code` (2), `agribalyse_food_code` (21), `agribalyse_proxy_food_code` (17), and typo variants (`ciqual_food_proxy_code`, `ciqual_proxy_proxy_food_code`). Together they add +27 entries, measured before USDA.
  - They should be tried *after* USDA: `en:celery` carries only `ciqual_proxy_proxy_food_code` 20055 "Céleri-rave" (celeriac), while its USDA proxy is "Celery, raw".
  - `ifct_food_code` (117), `average_weight_per_unit` and `density_g_per_ml` are not macros.
- **CALNUT** (lever 1b):
  - ANSES's "table … sans valeurs manquantes" fills energy for 2020-only codes: apple 48.9 kcal, agave syrup 305 kcal. Lentil 20504 is not in CALNUT.
  - ANSES warns that the filled values come from "comblement automatique ne respectant pas les critères habituels de qualité de la table Ciqual".
  - Its conditions are those of CIQUAL; the citation is "Anses. 2020. Table de composition nutritionnelle Ciqual pour le calcul des apports nutritionnels CALNUT" [V, OFF's vendored README].
  - OFF already loads it over CIQUAL (`NutritionCiqual.pm`, per `research.md`).
  - OFF's `CALNUT.csv.0` holds 2,119 food codes. [V]

### Lever 2: USDA codes [V]

- Codes tried in this order: `usda_ndb_code`, `usda_fdc_code`, `usda_ndb_proxy_code`, `usda_fdc_2_code`, `usda_ndb_2_code`, `usda_fdc_3_code`, `usda_ndb_3_code`.
- They resolve in SR Legacy (2018) and Foundation (2026-04). Energy is `1008` (kcal), falling back to Atwater `2047`/`2048`; carbohydrate is `1005`, falling back to `1050`.
- **Gains:**
  - +258 entries not covered by CIQUAL at all.
  - +504 entries switching from a borrowed CIQUAL number to their own USDA one. Examples: cream cheese no longer "Cheese (average)", lime juice no longer "Fruit juice (average)", cabbage and walnut no longer uncovered.
  - Usage-weighted own coverage: 88.8% → 91.2%.
- **Quality check.** 296 entries carry both their own CIQUAL and their own USDA number, and 25 of them (8%) disagree by more than 50 kcal and 30%. Examples:
  - buttermilk: 36 (CIQUAL) vs 387 kcal (USDA *dried* buttermilk)
  - bacon: 349 vs 902 (bacon *grease*)
  - chili pepper: 37 vs 324 (dried)
  - tarragon: 44 vs 295 (dried)
  - walnut: 378 vs 654

  So prefer CIQUAL when both exist, and expect a similar error rate on USDA-only entries. [V for the 8%; I that it carries over]
- Licence CC0. SR Legacy is frozen; Foundation updates in April and October.

### Lever 3: Canadian Nutrient File, CoFID, Frida [V/I]

- **CNF by code:** +0. All 780 NDB codes on the taxonomy already resolve in SR Legacy, and CNF's `USDA_NDB_Code` only points back to them. [V]
- **CNF and CoFID as name-matching targets:** these are where they help, through English and French names (CNF) and UK names (CoFID).
  - Of the 232 name matches that end up as own numbers, 64 come from CoFID and 25 from CNF. Examples: whipping cream, single cream, sauerkraut, garam masala, yeast extract, low-fat cheese, romano.
  - Licences: CoFID is UK OGL v3 (ODbL-compatible per OSMF); CNF is OGL-Canada ("requires inspection" per OSMF). See `research.md` §5.
- **Frida:** not measured (Danish names, no join key). [I: low value next to CIQUAL and USDA for this taxonomy]

### Lever 4: name matching with no AI [V]

`names.py` matches every taxonomy `en`/`fr`/`xx` name against four source name lists:

- CIQUAL 2025 French and English names (XML) plus CIQUAL 2020
- USDA SR Legacy and Foundation descriptions
- CNF English and French
- CoFID

Only targets with all four macros are considered. Rungs, first hit wins; sources are tried in the order CIQUAL > USDA > CNF > CoFID:

1. **Exact:** lowercase, accents folded, punctuation removed.
2. **Normalised:**
   - parentheses dropped, stopwords dropped (`of/de/du/with/avec/…`);
   - raw-state words dropped (`raw, cru(e)(s), fresh, frais, average, aliment moyen, plain, nature, pulp, flesh, unprepared, uncooked, and/et/or/ou`);
   - simple English and French singularisation, then compared as a sorted token set, so "Onions, red, raw" matches "red onion";
   - words that change the food are kept: whole, cooked, dried, powder, smoked, salted.
3. **Ambiguity rule:** when several targets share a key, accept only if their kcal agree within 10% (or 15 kcal); otherwise no match.

**Results:**

- 1,323 entries match at some rung. Most are already covered by codes.
- The matches that change something: **232 entries get own numbers from a name**. 41 of those are new coverage; 191 are upgrades from a borrowed value.
- Most upgrades are corrections:
  - wine 660 → 77 kcal
  - dried acid whey 24 → 339
  - whipping cream 248 → 381
  - yeast extract 334 → 180
  - sauerkraut 35 → 9

**Precision, hand-checked:**

| Sample | Correct | Notes |
|---|---|---|
| 50 random contributing matches (`sample_names.py`, seed 11) | 50/50 | Two are borderline but acceptable: `en:nut`→"Nuts, mixed", and `en:bilberry` via its taxonomy synonym "huckleberry" |
| 60 random matches of any kind, before "whole" was protected | 59/60 | The miss was "whole rice flour" → "Rice flour". Fixed by keeping "whole". |
| Fuzzy rung (`difflib` ratio ≥ 0.92, same token count, clear winner), all 37 | 21 (57%) | Wrong: cinnamon→Canelé, cured cheese→curds, lightly salted butter→light butter, ground beef→beef round, pomelo juice→apple juice, strawberry→raspberry juice concentrate, three flour types to the wrong type, and others. **Not usable.** |
| "Head noun" rung (taxonomy name = first comma segment of a source name), 40 sampled | 30 (75%) | It catches cumin, brandy and sherry, but also beans→mung beans, citron→"Citron" (French for lemon), lasagne→frozen cheese lasagna, fat→beef tallow, truffle→chocolate truffles, popcorn→candied popcorn. **Not usable as is.** A whitelist of state suffixes for spices ("X, seed", "X, powder") would rescue cumin, the single biggest gap, but I did not measure it. |

### Lever 5: smarter inheritance [V, with estimates marked]

**Leave-one-out test (`inherit.py`).** For the 1,502 entries that have numbers of their own *and* an ancestor with numbers, I compared the entry's own kcal with what it would borrow.

- **21.8%** of borrows are "bad" (off by > 50 kcal *and* > 30%). The median absolute error is 15 kcal.
- Bad rate by distance:

  | Distance | Bad | Sample |
  |---|---|---|
  | 1 | 22% | 1,372 |
  | 2 | 25% | 123 |
  | 3 | 0% | 7 |

  **Depth does not predict error.**
- **Bad lenders** (at least 5 leave-one-out children):

  | Lender | Bad rate | Its value | Note |
  |---|---|---|---|
  | `en:sauce` | 100% | 246 kcal | via a name match to "Sauce (average)", a lever-4 side effect |
  | `en:alcohol` | 94% | 660 kcal, pure ethanol | |
  | `en:coconut` | 83% | | |
  | `en:soy-protein` | 67% | | |
  | `en:ham` | 60% | | |
  | `en:cod` | 60% | | |
  | `en:chicken-meat` | 60% | | |
  | `en:beef-meat` | 59% | | |
  | `en:cream` | 50% | | |
  | `en:wine` | 50% | | |
  | `en:milk` | 46% | | skimmed |
  | `en:fish` | 41% | | 68 children |
  | `en:pork-meat` | 41% | | |
  | `en:herb` | 35% | | |

- **Bad rate by shared root:**

  | Root | Bad | Root | Bad |
  |---|---|---|---|
  | alcohol | 80% | dairy | 17% |
  | sauce | 69% | cereal | 13% |
  | animal | 44% | fruit | 11% |
  | herb | 41% | flour | 4% |
  | meat | 37% | oil-and-fat | 1% |
  | fish | 28% | juice | 0% |
  | vegetable | 20% | | |

- **Form words.** When the child adds a "form word" its lender lacks (broth, oil, juice, powder, dried, extract, cheese, milk, …), the bad rate is 34%, against 19% otherwise. Example: `en:chicken-broth` borrows raw chicken at 173 kcal.

**Rules on the actual borrowers of the best configuration.** 2,577 entries borrow. The estimated bad count applies each lender's leave-one-out bad rate to its actual borrowers, with 21.8% for lenders with fewer than 5 samples, so it is [I]:

| Rule | Coverage | Usage-weighted | Est. bad borrows |
|---|---|---|---|
| none | 4,449 (78.1%) | 95.6% | ≈620 (10.9% of all entries) |
| block 10 bad lenders (6a) | 4,345 (76.2%) | 95.1% | ≈533 |
| block only `en:alcohol` + `en:sauce` | 4,406 (77.3%) | 95.3% | ≈578 |
| parent only (6b) | 3,902 (68.5%) | 95.4% | ≈488 |
| form-word rule (6c) | 3,930 (69.0%) | 94.8% | ≈497 |
| form-word + block lenders | 3,844 (67.5%) | 94.4% | ≈426 |
| no borrowing (6d) | 1,872 (32.8%) | 93.3% | 0 |

Reading [I]:

- Lender blocking is the efficient rule, at about 1 entry lost per bad borrow avoided. "Parent only" is the least efficient, at about 4 entries lost per bad borrow avoided.
- Usage-weighted, every rule moves less than 1.2 points, because recipes rarely name entries that borrow. Only 2.3% of mentions borrow in the best configuration, against 14.3% at the baseline.
- CONTEXT.md already says a borrowed total "says it is estimated". The trade is therefore mainly about how many entries show an estimate that is badly off.

### Usage-weighted correctness of the best configuration [V hand check, my judgement]

I read the value every one of the 307 recipe-used entries gets (`top_usage.py`). Wrong or misleading values, by Ahn mentions:

| Entry | Mentions | Value | Why |
|---|---|---|---|
| `en:milk` | 12,895 | own proxy "Milk, skimmed", 33 kcal | OFF's code |
| `en:corn` | 4,777 | own "Corn grain, raw", 346 kcal | recipes mean sweet corn; OFF's code |
| `en:chicken-broth` | 3,454 | borrows raw chicken, 173 kcal | |
| `en:hot-sauce` | 965 | borrows "Sauce (average)", 246 kcal | |
| `en:beef-broth` | 835 | own "Broth, beef, dehydrated", 232 kcal | OFF's code |
| `en:sherry` | 630 | borrows wine, 77 kcal | |
| `en:brandy`, `en:beer`, `en:tequila` | 840 | borrow pure alcohol, 660 kcal | |
| `en:pistachio-nuts` | 219 | own "Macadamia nut, grilled, salted" | OFF's code |
| `en:katsuobushi`, `en:sumac`, `en:peppermint-oil` | 72 | | |

That totals about 24,700 mentions (5.4%). So: **covered 95.6%, plausibly right ≈ 90%, wrong ≈ 5.4%, uncovered 4.4%.**

- Most of the wrong share comes from codes on the taxonomy itself (milk, corn, beef broth, pistachio), so no lever here fixes it.
- Judgement calls I counted as acceptable:
  - yeast → "Yeast, flakes" 334 kcal
  - potato → boiled
  - shiitake → dried
  - chickpea → canned
  - bacon → pancetta

## The leftover: what is still uncovered [V counts, rule-based buckets so I]

1,250 entries are uncovered in the best configuration. 219 of them have no parent. Buckets, by root and keyword rules (`leftover.py`):

| Bucket | Entries | Ahn mentions | Examples |
|---|---|---|---|
| Flavourings, aromas, essential oils, extracts | 298 | 456 (0.10%) | mushroom flavouring, natural hops flavouring, ginseng root extract, `en:smoke` |
| Wine grape varieties (`en:varietal`) | 52 | 0 | mourvèdre, Grk Bijeli |
| Ferments, cultures, enzymes, rennet | 72 | 0 | Lactobacillus, Aspergillus sojae, animal rennet |
| Fibres, protein isolates, oligosaccharides, emulsifiers, other technical | 174 | 0 | pea fiber, betaglucan, mono- and diglycerides, beeswax, menthol |
| Industrial preparations, fillings, coatings, glazes, fonds | 90 | 1,313 (0.29%) | apricot filling, zuppa inglese preparation, shellfish fond |
| Generic group nodes (≥ 3 children) | 72 | **12,331 (2.68%)** | **beef, pork, lamb, vegetable, meat, milkfat, kidney bean, barley, cereal, brassica**, red bean, malt, whey, poultry, pulse |
| Industrial derivatives inside "real foods" (second-pass rule) | 182 | small | whey powders, caseinates, hydrogenated fats, glucose syrups, gums, blood plasma |
| **Cooking foods** (everything else) | **≈310** | 5,960 (1.29%) | **cumin, beans, black bean, smoked sausage, liver, juniper berry**, game meats, bean varieties (flageolets, cannellini, adzuki), split peas, broths and stocks (bouillon de veau, meat stock, dashi), herbal-tea plants, vanilla forms, meatballs, French fries, omelette |

- **Uncovered and used by recipes (Ahn mentions):** beef 5,044 · cumin 3,220 · pork 2,089 · beans 1,903 · vegetable 1,660 · seed 1,313 · meat 970 · milkfat 947 · black bean 474 · lamb 472 · smoke 456 · kidney bean 442 · smoked sausage 268 · barley 232 · cereal 204 · brassica 109 · red bean 92. The rest are under 50 each.
- Beef, pork and lamb have no code and 17–20 children each. Their children (cuts) have codes, so a parent could be given a code by hand, or by a "most common child" rule. I did not measure that rule. [I]
- Whether `en:vegetable`, `en:meat` and `en:seed` *should* get numbers is a product question: a line saying "vegetables" has no single right number.

## Method (to reproduce)

Scripts live in my session scratchpad (`/private/tmp/claude-501/-Users-mike-Documents-norish/5932eb0f-…/scratchpad`), not the repo. All are plain Python 3 with the standard library only; xlsx files are read with a 25-line zip/XML reader.

1. **Inputs** (fetched 2026-10-01; total about 50 MB, no OFF product dump):

   | File | Source |
   |---|---|
   | `ingredients.txt`, `categories.txt` | OFF taxonomies, from `research.md`'s session |
   | CIQUAL 2025 English xlsx and the 2025 XML 7z (French + English names) | ciqual.anses.fr |
   | CIQUAL 2020 tab-separated file | OFF repo |
   | `CALNUT.csv.0` | `openfoodfacts-server/external-data/ciqual/calnut/`, via GitHub raw, not OFF hosts |
   | FDC SR Legacy 2018-04 and Foundation 2026-04 CSVs | fdc.nal.usda.gov |
   | CNF 2026 `food_name.csv` + `nutrient_amount.csv` | open.canada.ca |
   | CoFID 2021 xlsx, sheet "1.3 Proximates" | gov.uk |
   | Ahn et al. supplementary data 3 | springer static-content |

   I made **no** openfoodfacts.org API calls in this session.
2. `load.py`:
   - Parses the taxonomy with the rules of `packages/shared-server/src/ingredients/seed/parse-taxonomy.ts` (same ids, first entry wins, parents resolved through any name), plus properties. Result: 5,699 entries.
   - Loads every source as code → (kcal, protein, carbohydrate, fat).
   - CIQUAL's EU-regulation kcal column is used as is, with no Jones fallback; the 2025 table never has Jones energy where EU energy is missing.
3. `baseline.py` → step 0. `levers.py` → steps 0–5 (cumulative configurations of one `resolve_all(cfg)`). Own numbers come first; else the nearest ancestor by breadth-first distance with own numbers, subject to `maxd`/`blocked`.
4. `names.py` → the name index and matches (`name_matches.json`). `sample_names.py` → the 50-sample. `head_rung.py` → the rejected head rung.
5. `inherit.py` → the leave-one-out test. `rules.py` and `summary.py` → the rule trade-offs and the final table. `leftover.py` → buckets. `top_usage.py` → per-ingredient values for the usage hand check. `checks.py` → USDA/CIQUAL agreement, the category-bridge sample, and CALNUT and ordering deltas.
6. The "bad" threshold is |Δkcal| > 50 **and** > 30% of the true value. It is my choice, meant to flag errors a cook would notice in a recipe total.

## Open questions

1. **Minted Ingredients have no numbers at all.** In the dev database, 40 of 57 recipe lines resolve to minted Ingredients with no `off_id`, and only 1 of those has a parent. Examples: "milde olijfolie", "verse peterselie", "ground cumin". Recipe-level coverage may therefore be limited more by alias resolution and parent assignment than by the nutrition source. The dev data may predate the current resolver, so this needs checking on a realistic instance before deciding anything. [V counts; I for the cause]
2. **Should the taxonomy's own wrong codes be overridden in Norish or fixed upstream in OFF?** The cases are milk = skimmed, corn = dry grain, beef broth = dehydrated, pistachio = macadamia, and celery via `ciqual_proxy_proxy_food_code` = celeriac. Upstream fixes help everyone and keep the seed "just the file". A Norish override list is faster but is data Norish has to maintain.
3. **CALNUT's imputed values.** ANSES says they do not meet CIQUAL's usual quality criteria. Should they count as "taken from an open food dataset", or be shown as estimated?
4. **Generic nodes** (`en:vegetable`, `en:meat`, `en:seed`, `en:fruit` which currently name-matches "Fruit, raw (average)"): blank, average, or "most common child"?
5. **A narrow head-noun rung for spices** ("X, seed/powder/ground") would cover cumin, the biggest single gap at 3,220 mentions. I did not measure its precision.
6. **A better usage source.** Ahn's 2011 coarse names favour staples. A European or Dutch recipe corpus, or real instance data, could shift the usage-weighted numbers. That should be checked before the usage numbers are treated as targets.
7. **CNF's licence** (OGL-Canada) compatibility with ODbL is still "requires inspection" (from `research.md`). It matters only if the CNF name matches (25 entries) are kept.
8. **The leave-one-out estimate** assumes actual borrowers err like entries that have their own numbers. Actual borrowers skew to niche and processed forms, so the true bad rate is probably higher. [I]
