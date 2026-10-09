# Ingredient Nutrition without AI: sources research

Researched 2026-10-01. Markers: **[V]** verified against the cited primary source (page, licence text, source code, or a file I downloaded and counted); **[I]** inferred or estimated by me, with the reasoning given. Counts over the OFF ingredients taxonomy were made by parsing `ingredients.txt` (fetched 2026-10-01 from the same URL Norish's seed uses) with the same rules as `packages/shared-server/src/ingredients/seed/parse-taxonomy.ts`. That gave 5,699 entries, which matches ADR-0038's "about 5,700".

## Bottom line

- **The bridge already exists in the file Norish seeds from.** 1,066 of the 5,699 ingredients-taxonomy entries carry a CIQUAL code of their own (`ciqual_food_code` or `ciqual_proxy_food_code`). 1,052 of those resolve to a row in the CIQUAL 2025 or 2020 table. With codes inherited from the nearest ancestor that has one, 3,962 entries (~70%) resolve. 804 entries also carry USDA codes (`usda_ndb_code`, `usda_fdc_code`, proxies), and all 780 NDB codes resolve in USDA SR Legacy. [V] Norish already stores `off_id`, so the join is `off_id → taxonomy property → CIQUAL/USDA row`. No name matching is needed.
- **OFF itself does exactly this**, inheritance included. `NutritionEstimation.pm` looks up `get_inherited_property("ingredients", id, "ciqual_food_code:en") // …"ciqual_proxy_food_code:en"`, then reads the vendored CIQUAL 2020 + 2025 tables. [V] That matches the CONTEXT.md rule that an Ingredient borrows from its nearest parent.
- **Smallest licence-clean footprint (option A):** CIQUAL 2025, 3,484 foods. The English xlsx is 1.5 MB, and only kcal, protein, carbohydrate and fat are needed. It is under the Etalab Licence Ouverte 2.0, which says it is compatible with any free licence that requires at least attribution. [V] On a self-hosted instance it is roughly a ~1,000–4,000-row table derived once from two small files: the taxonomy Norish already fetches, plus CIQUAL. [I]
- **Optional second source (option B):** USDA SR Legacy, under CC0 / public domain. It has 7,793 foods and a 6 MB zip, frozen since 2018. Its `food_portion` table holds household-measure gram weights for 7,533 foods: for example onion is 1 large = 150 g, 1 medium = 110 g, 1 cup chopped = 160 g. [V] It can supply piece weights, which CIQUAL lacks entirely. The OFF taxonomy has its own `average_weight_per_unit` on only 45 entries (537 with inheritance). [V]
- **NEVO is not usable for an open seed.** Its 2025 conditions do not literally say "no redistribution", but they say the data are RIVM copyright, may be used "only … unchanged", "the user is not entitled to make amendment", and "the user is not allowed to charge (end)users". The dataset is obtained by agreeing to those conditions. [V] That is incompatible with ODbL share-alike, which lets anyone modify. ADR-0038's wording ("forbid redistribution") overstates the letter of the text. Its conclusion still holds.
- **A product (per-brand) database is a different scale.** OFF's full exports are 13.0 GB (JSONL.gz), 15.9 GB (MongoDB dump), 7.9 GB (Parquet) and 1.28 GB (CSV.gz; 13.0 GB unpacked), with ~4.77 M food products. [V] OFF publishes no per-country export. [V, absent from the data page] A Netherlands slice is ~111 k products and a France slice ~1.27 M. [V, API counts] If cut down to the macro columns, I estimate tens of MB for NL and a few hundred MB for FR. [I] Someone, Norish or the instance, would have to build that slice from the full dump.
- **The OFF API is not a per-instance backend.** It allows 15 product reads/min/IP and 10 searches/min/IP, says "don't use it for a search-as-you-type feature", and has global limits that return 503. During this research it returned 503/429 on roughly half of my paced calls. [V] OFF's own advice for heavy users is a local Product Opener or the bulk exports.
- **What a product database adds** is brand-exact label numbers for the products a household actually buys. That is the Store Product side, which CONTEXT.md deliberately keeps out of Ingredient Nutrition ("never a brand's"). It also enables OFF-style category averages. **What it costs:** GB-scale fetches per instance (or a Norish-hosted slice), ODbL share-alike on the derived table, and crowd-sourced data quality, which OFF explicitly does not guarantee. [V]
- **OFF's own per-category averages** (trimmed mean, std, p10/p90, min 10 products) are computed by `gen_top_tags_per_country.pl`. They are stored as Perl Storable files in OFF's private data directory, and I found no public export of them. [V for code; absence of an export is unverified, see Open questions]

## 1. Open Food Facts exports, sizes, cadence, API terms

### Exports listed on the official data page ([world.openfoodfacts.org/data](https://world.openfoodfacts.org/data)) [V]

Sizes are from HTTP `Content-Length` and `Last-Modified` headers I fetched on 2026-10-01. [V]

| Export | URL | Size (2026-09-30 build) | Cadence |
|---|---|---|---|
| MongoDB dump | `static.openfoodfacts.org/data/openfoodfacts-mongodbdump.gz` | **15.9 GB** (15,915,568,510 B), the user's "~15 GB" | "generated nightly" |
| JSONL | `static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz` | **13.0 GB** compressed | nightly (same Last-Modified as the dump) |
| CSV (food) | `static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz` | **1.28 GB** gz / **13.0 GB** plain; tab-separated; 211 columns | nightly |
| CSV, French-language columns | `.../fr.openfoodfacts.org.products.csv` | 13.3 GB plain. This is the world database with French labels, **not** a France-only slice [I, from its size] | nightly |
| Parquet (Hugging Face) | `huggingface.co/datasets/openfoodfacts/product-database` → `food.parquet` | **7.87 GB**; 4,769,948 food rows ([HF datasets-server info](https://datasets-server.huggingface.co/info?dataset=openfoodfacts/product-database)) | cadence not stated on the card ([dataset card](https://huggingface.co/datasets/openfoodfacts/product-database)) |
| Delta exports | `static.openfoodfacts.org/data/delta/index.txt` | one JSON.gz per day, last 14 days; I could not size them (429) | daily; "cannot tell you about deleted products" |
| Recent changes | `.../openfoodfacts_recent_changes.jsonl.gz` | 1.53 GB | nightly |
| RDF | `.../en.openfoodfacts.org.products.rdf.gz` | n/a | "experiment, not actively maintained anymore" |

- **No per-country export** is listed on the data page. [V] Country filtering is possible on any export through `countries_tags` (a CSV column, and a list column in Parquet). [V: CSV header read from the first 64 KB via a Range request; [HF features](https://datasets-server.huggingface.co/info?dataset=openfoodfacts/product-database)]
- **Nutrition fields** in the CSV include `energy-kcal_100g`, `fat_100g`, `carbohydrates_100g`, `proteins_100g`, `serving_size`, `serving_quantity`, `product_quantity` and `no_nutrition_data`. [V, CSV header] In Parquet, `nutriments` is a list of `{name, value, 100g, serving, unit, prepared_*}`. [V, HF features]
- **Taxonomy links on product rows:** `categories_tags`, `ingredients_tags`, `main_category`. [V, CSV header] Parquet also has `categories_properties.{ciqual_food_code, agribalyse_food_code, agribalyse_proxy_food_code}`, `ciqual_food_name_tags`, `ingredients_without_ciqual_codes`. [V, HF features] So a product row links to the **categories** taxonomy (and through it to CIQUAL), and its `ingredients_tags` are ingredients-taxonomy ids (the same ids as Norish's `off_id`). [V for field presence; that `ingredients_tags` uses the same `en:onion` keys is [I], from OFF's taxonomy id convention]
- **Country slice sizes.** Product counts come from `api/v2/search?countries_tags=en:<c>&page_size=1`, read on 2026-10-01. [V] The size estimates are proportional to the 13.0 GB CSV and the 4.77 M rows. [I]

  | Slice | Products | Share | Full-column CSV (est.) | Macro-only columns (est.) |
  |---|---|---|---|---|
  | Netherlands | 111,260 | 2.3% | ~0.3 GB plain / ~30 MB gz | ~15–25 MB plain [I, ~150–200 B/row] |
  | France | 1,271,194 | 26.6% | ~3.5 GB plain / ~340 MB gz | ~190–250 MB plain [I] |
  | United States | 978,680 | 20.5% | ~2.7 GB plain | ~150–200 MB plain [I] |
  | Germany | 428,449 | 9.0% | ~1.2 GB plain | ~65–85 MB plain [I] |

  Building any slice means someone downloads and filters the whole export (or range-reads the Parquet's columns). OFF does not serve slices. [I]
- **API terms** ([API intro, source](https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/docs/api/index.md); [rendered](https://openfoodfacts.github.io/openfoodfacts-server/api/)) [V]:
  - "15 req/min/IP address for all read product queries"; "10 req/min/IP address for all search queries … don't use it for a search-as-you-type feature, you would be blocked very quickly." Over the limit, they reserve the right to ban the IP.
  - "If your requests come from your users directly (ex: mobile app), the rate limits apply per user." A self-hosted server calling OFF would be one IP per instance. [I]
  - "If you need to fetch more than a few hundred products, we ask you to download the data as a CSV or JSONL file directly."
  - There are global rate limits that return HTTP 503. I hit both 503 (world.openfoodfacts.org) and 429 (static.openfoodfacts.org) at well under 15 req/min. [V, observed]
  - A custom User-Agent `AppName/Version (ContactEmail)` is required.
  - "If you expect your app to generate a lot of API traffic, we strongly encourage you to host a local instance of Product Opener … and use the daily exports to update your local database."
  - The data page says: "1 API call = 1 real scan by a user. Any attempt to scrape using the API will very likely be blocked." [V, [data page](https://world.openfoodfacts.org/data)]
- **Licence of the exports** ([terms of use](https://world.openfoodfacts.org/terms-of-use)) [V]: the database is under ODbL, individual contents under DbCL, and images under CC-BY-SA. Re-users must "attribute the authorship to Open Food Facts with a link to https://openfoodfacts.org"; "Derivative works must be shared under the same conditions."

## 2. Does OFF publish per-food (generic) nutrition?

**Not as numbers. OFF publishes pointers to CIQUAL/USDA in its taxonomies and does the lookup itself.** [V]

### Ingredients taxonomy (`taxonomies/food/ingredients.txt`, the file Norish seeds from)

Property counts are per entry, out of 5,699 entries. "Self" means the entry carries the property. "Inherited" means the entry or any ancestor carries it. [V, own parse]

| Property | Self | Self or ancestor |
|---|---|---|
| `ciqual_food_code` | 919 | 3,122 |
| `ciqual_food_code` or `ciqual_proxy_food_code` | 1,066 | 3,986 |
| …of which resolve in CIQUAL 2025 (or 2020, as OFF loads both) | 1,052 | 3,962 (OFF's lookup order) |
| USDA (`usda_ndb_code` / `usda_fdc_code` / `usda_ndb_proxy_code`) | 804 | 2,280 |
| CIQUAL or USDA | 1,567 | 4,251 |
| `average_weight_per_unit` (grams per piece) | 45 | 537 |
| `density_g_per_ml` | 8 | 557 |

Other nutrition-adjacent properties: `ifct_food_code` (Indian food composition table), `usda_ndb_2_code`, `ciqual_food_2_code` (secondary codes for processed forms) and `average_weight_per_unit_large`. [V]

- Examples [V]:
  - `en:onion` → CIQUAL 20034 "Oignon, cru", USDA NDB 11282, average 150 g/unit.
  - `en:egg` → 22000, 60 g/unit.
  - `en:wheat-flour` → proxy 9410 (T110).
  - `en:butter` → proxy 16400.
  - `en:milk` → proxy 19051 (*skimmed*).
  - `en:olive-oil` → proxy 17270.
  - `en:rice` → 9100.
- Proxies are approximations chosen by OFF contributors. For example `en:milk` → skimmed milk. [V] Expect some to need human correction. [I]
- Inheritance lenders seen [V]: `en:honey` (75 children), `en:cheese` (72, "Cheese -average-"), `en:fish` (65, "Fish, cooked (average)"), `en:rice`, `en:herb` ("Herbs, fresh -average-"), `en:spice`, and `en:alcohol` (45 children, CIQUAL 1014 "Alcool pur", 660 kcal). That last one would mislend pure-ethanol values to any child that has no code of its own. [I] `en:vegetable`, `en:fruit` and `en:meat` carry no code. [V]
- 297 entries have no parent. [V]
- In the 2025 table, 45 distinct codes used by the taxonomy are missing. 33 of them exist in CIQUAL 2020. [V] OFF handles this by loading both versions (`CIQUAL_versions.csv`: 2020, 2025) and keeps an `old_ciqual_2020_codes_used_in_taxonomies.csv`. [V, [repo dir](https://github.com/openfoodfacts/openfoodfacts-server/tree/main/external-data/ciqual/ciqual)]

### Categories taxonomy (`taxonomies/food/categories.txt`)

The file has 14,693 entries. [V] `ciqual_food_code` is on 2,882 entries (10,270 with inheritance), `agribalyse_food_code` on 2,533, and `ciqual_proxy_food_code` on 115. It has **no** USDA codes and no unit weights. [V] Agribalyse is environmental-impact data, keyed by the same CIQUAL codes. [I]

### OFF's own use of these codes

- `lib/ProductOpener/NutritionEstimation.pm`: "uses nutritional databases such as CIQUAL to estimate the nutrients of a product, using its list of ingredients". It reads the inherited `ciqual_food_code`, else the inherited `ciqual_proxy_food_code`, and weights each ingredient by `percent_estimate`. [V, [source](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/NutritionEstimation.pm)]
- `lib/ProductOpener/NutritionCiqual.pm` loads the CIQUAL table, then CIQUAL CALNUT, which "overrides the possibly partial data". The data is vendored under `external-data/ciqual/` (CIQUAL 2020 + 2025 CSVs, CALNUT 2020). It credits "Anses. 2020. Ciqual French food composition table." [V, [source](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/NutritionCiqual.pm)]
- The OFF repo is itself a public redistribution of CIQUAL-derived CSVs inside an AGPL codebase. That is precedent for an open-source project redistributing CIQUAL under the Licence Ouverte. [V for the fact; licence reading is [I]]

**Coverage summary [V/I]:** about 18% of seeded Ingredients would have numbers of their own from CIQUAL alone. About 70% would have numbers with nearest-parent inheritance. Adding USDA raises own-number coverage to ~27% and inherited coverage to ~75%. [V counts] Most of the remaining ~25% are probably roots or near-roots with no code (`en:vegetable`, `en:fruit`, `en:meat`, many additives and flavourings), which the CONTEXT.md design would leave blank or "estimated". [I]

## 3. Generic food-composition tables

### CIQUAL (ANSES, France), 2025 edition [V]

- **Release:** 19 Nov 2025 (files dated 2025-11-03). It has 3,484 foods and 74 constituents, and adds 300 foods over 2020 ([ANSES news](https://www.anses.fr/en/content/new-enhanced-and-more-representative-version-ciqual-table)). The previous edition was 2020, so cadence is roughly every 3–5 years. [I, from 2020 → 2025]
- **Downloads** ([ciqual.anses.fr/cms/en/download](https://ciqual.anses.fr/cms/en/download)):
  - English .xlsx: 1.5 MB (downloaded)
  - .xls: 4.7 MB
  - XML .7z: 1.7 MB
  - "Table of average foods and their contributors"
  - 2020→2025 change log (French)
  - French and English versions
- **Columns** (English xlsx, read): `alim_code`, `alim_nom_eng`, group codes, Energy EU 1169/2011 kJ/kcal, Protein, Carbohydrate, Fat, Sugars, Fibres, Salt, etc. [V] 3,323 of 3,484 foods have all four of kcal/protein/carb/fat as a number, "traces" or "< x". [V, own count] Values use decimal commas and the markers "-", "traces" and "< x". [V]
- **No portion sizes or piece weights** in the table columns. [V, header list]
- **Licence:** "Data may be used under the terms and conditions of the Open Licence." There are conditions on top of the licence:
  - The information must not be altered and its sense not denatured.
  - The source and version date must be mentioned. Required citation: "Anses. 2025. Ciqual French food composition table."
  - Reuse must not mislead about content, source or date.

  [V, [download page](https://ciqual.anses.fr/cms/en/download)] [data.gouv.fr](https://www.data.gouv.fr/datasets/table-de-composition-nutritionnelle-des-aliments-ciqual-2020) lists the 2020 edition as "Licence Ouverte / Open Licence" (`fr-lo`). [V]
- **Redistribution to every instance:** permitted, with attribution and the version date. [V/I] Per-100 g numbers carried through unchanged meet "not altered". A person's correction on an instance is that instance's own data, not a claim about CIQUAL, so attribution should say "based on". [I]

### USDA FoodData Central [V]

- **Licence:** "USDA FoodData Central data are in the public domain and they are not copyrighted. They are published under CC0 1.0 Universal". The suggested citation is requested, not required ([API guide](https://fdc.nal.usda.gov/api-guide/)).
- **Downloads** ([download page](https://fdc.nal.usda.gov/download-datasets/)):

  | Dataset | Release | Size (zipped / unzipped) | Foods | Cadence |
  |---|---|---|---|---|
  | Foundation Foods | 04/2026 | JSON 459 K / 6.5 M; CSV 3.7 M / 32 M | 395 (my count) | April and October ([docs](https://fdc.nal.usda.gov/data-documentation/)) |
  | SR Legacy | 04/2018, final | CSV 6.7 M / 54 M | 7,793 | final release |
  | FNDDS | 10/2024 | CSV 200 M / 1.6 G | ~5k+ (not counted) | every two years with NHANES |
  | Branded | 04/2026 | CSV 428 M / 2.9 G | | |

  [V, counts from downloaded CSVs]
- **Portion weights:** SR Legacy's `food_portion.csv` has 14,449 rows covering 7,533 of 7,793 foods, with `amount`, `modifier` and `gram_weight`. Foundation has 10,951 portion rows. [V, downloaded] Converting to a portion is `amount × gram_weight / 100`. [I, standard FDC schema]
- **Join to OFF:** all 780 taxonomy entries with `usda_ndb_code`/`usda_ndb_proxy_code` resolve via `sr_legacy_food.csv` (`NDB_number → fdc_id`). 651 `usda_fdc_code` values resolve in Foundation or SR Legacy. [V]
- **Languages:** English only. [I] FDC publishes no translations; Norish already has the names from OFF, so this does not matter.
- **API:** "a data.gov API key must be incorporated into each API request"; default limit is 1,000 requests/hour/IP. [V] The API is not needed if the CSVs are used.

### NEVO (RIVM, Netherlands) [V]

- **Version 2025/9.0** (Nov 2025): energy and ~130 nutrients for 2,328 foods ([NEVO online](https://www.rivm.nl/en/dutch-food-composition-database/nevo-online)). Values are per 100 g edible part. Releases came in 2023 and 2025, so a cadence of about every 2 years. [I]
- **Obtained by request**, which means agreeing to the conditions ([request page](https://www.rivm.nl/en/dutch-food-composition-database/nevo-online-request-dataset)).
- **Conditions of use 2025/9.0** ([PDF](https://www.rivm.nl/sites/default/files/2025-11/Conditions-of-use-NEVO-online-2025-dataset_0.pdf)), verbatim:
  - "The data contained in the NEVO dataset are the copyright of … RIVM"
  - "Using the information from NEVO online is only allowed unchanged and stating the source and version number."
  - "The user is entitled to make additions … The user is **not** entitled to make amendment"
  - "Any output from software for nutritional calculations produced by the user must contain … 'Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven'"
  - "The user is **not** allowed to charge (end)users for the use of NEVO online version 2025/9.0 data."
- **Verdict on ADR-0038's claim:** the text has no clause that literally says "you may not redistribute". It is still not an open licence: copyright is reserved, amendments are banned, charging is banned, and access is by agreement. Putting it under ODbL, which grants everyone the right to modify and to use commercially, would breach "no amendment" and "no charging". So the ADR's conclusion (unusable for an open seed) holds, but its stated reason should read "not openly licensed: no amendments, no charging, by agreement". [V text, I interpretation]

### McCance & Widdowson's CoFID (UK) [V]

- 2021 edition (19 Mar 2021): 2,898 foods + 303 "old foods" and 185 nutrients ([Quadram FAQ](https://fnnbri.quadram.ac.uk/?p=34)). It is a 4.42 MB Excel file ([gov.uk](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid)).
- **Licence:** "All content is available under the Open Government Licence v3.0, except where otherwise stated", Crown copyright. [V, gov.uk page] OSMF lists OGL v2/v3 as ODbL-compatible ([OSMF compatibility](https://osmfoundation.org/wiki/Licence/Licence_Compatibility)). [V]
- No join path from the OFF taxonomy (no `cofid` property). English only. [V for property absence]

### Canadian Nutrient File 2026 [V]

- Open Government Licence – Canada ([open.canada.ca](https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109)). The full zip is 26.7 MB.
- `food_name.csv` has **5,993 foods** with **English and French** descriptions, and a `USDA_NDB_Code` column, so it joins to the OFF taxonomy through `usda_ndb_code`. [V, downloaded header]
- Includes `measure_weight_conversion.csv` (household measures → grams). [V, resource list]
- OSMF says Canadian OGL variants "require inspection". [V]

### Frida (DTU, Denmark), version 5.5 [V]

- **CC BY 4.0** (dataset files), published 19 Jan 2026. It is a 12.3 MB xlsx/ods with FoodEx2 and LanguaL codes, and documentation in Danish and English ([figshare API record](https://api.figshare.com/v2/articles/29500682); DOI 10.11583/DTU.29500682).
- More than 1,000 foods ([DTU](https://www.food.dtu.dk/english/About-us/Facilities-and-infrastructure/Food-Data-database-on-nutrients-in-food)).
- No OFF taxonomy join. OSMF notes all CC BY versions need explicit waivers for OSM. [V] Whether that matters outside OSM is [I]; see §5.

## 4. Aggregating OFF products per food

- **OFF's own prior art** is per-*category* nutrient statistics, made by `scripts/gen_top_tags_per_country.pl` with `ProductOpener::Stats::compute_stats_for_products`. [V, [Stats.pm](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Stats.pm)]
  - **Method:** a mean and std computed "without the bottom and top 5% (so that huge outliers that are likely to be errors in the data do not completely overweight the mean and std)", plus min, max, p10 and p90.
  - **Minimum sample:** `$min_products = 10` per category per country (2 in tests).
  - **Storage:** per-country files `categories_stats_per_country.<cc>.sto` under `PRIVATE_DATA/categories_stats`.
  - **Use:** "displayed on category pages and used in product pages, as well as in data quality checks". [V]
  - This is a trimmed mean, not a median. [V]
- **These are categories, not ingredients.** The keys are categories-taxonomy ids (for example `en:plain-yogurts`), not ingredients-taxonomy ids, so they do not join to Norish's `off_id` directly. [V for ids, I for join] Many cooking staples (onion, garlic, flour) are categories too, but under different ids (for example `en:onions` in categories vs `en:onion` in ingredients). [I, not counted]
- **No public export** of the category stats was found among the data-page exports. [V absence on the data page] They are in a private data directory. [V]
- **Data quality caveats documented by OFF:**
  - The terms of use say OFF does not guarantee accuracy, "including … nutrition facts". [V, [terms](https://world.openfoodfacts.org/terms-of-use)]
  - The API docs say "The user assumes the entire risk of using the data". [V, [API docs](https://openfoodfacts.github.io/openfoodfacts-server/api/)]
  - OFF tracks `data_quality_errors_tags`, `data_quality_warnings_tags`, `no_nutrition_data` and `completeness` per product, which are usable as filters. [V, HF/CSV columns]
  - Daily data-quality stats exist ([wiki](https://wiki.openfoodfacts.org/Data_quality_stats)). [V, page exists]
  - Products carry "as sold" versus "prepared" values (`prepared_100g`), and the categories taxonomy has `default_nutrition_as_sold_per` / `default_nutrition_prepared_per` on a few entries. [V] A naive median must pick one. [I]
- **Building it in Norish** would mean a GB-scale pipeline (somewhere) that groups by category or ingredient tag, plus a category→ingredient mapping that does not exist today. The result would be ODbL. [I]

## 5. Licence compatibility

Norish's code is **AGPL-3.0** (`LICENSE`). Its catalogue tables are offered under **ODbL** (ADR-0038). The data licence is separate from the code licence. [V, repo]

| Source licence | Into an ODbL-licensed Norish catalogue | Notes |
|---|---|---|
| **Etalab Licence Ouverte 2.0** (CIQUAL) | **Compatible**. The licence text says: "conçue pour être compatible avec toute licence libre qui exige au moins la mention de paternité et notamment … OGL … CC-BY … ODC-BY". ODbL requires attribution. [V, [LO 2.0 PDF](https://static.data.gouv.fr/resources/licence-ouverte-2-0/20260909-072646/etalab-licence-ouverte-v2.0.pdf), text extracted] | Plus ANSES's added conditions: source and version date, not altered or denatured, not misleading. [V] OSM community threads treat LO as ODbL-compatible ([legal-talk 2020](https://lists.openstreetmap.org/pipermail/legal-talk/2020-September/008924.html)). [V that the thread exists; it is not an authority] |
| **CC0 / public domain** (USDA FDC) | **Compatible**, no conditions. Citation requested. [V] | |
| **UK OGL v3** (CoFID) | Compatible per OSMF. [V] | Attribution. |
| **Canada OGL** (CNF) | Probably compatible; OSMF says variants "require inspection". [V/I] | |
| **CC BY 4.0** (Frida) | Unclear. OSMF says CC BY versions need explicit waivers for OSM. [V] This concerns CC BY 4.0's ban on effective technological measures and how attribution passes downstream; I have not verified whether it applies to a non-OSM ODbL database. [I] | |
| **NEVO conditions** | **Incompatible** (no amendment, no charging, by agreement). [V text] | |
| **OFF ODbL** (products, category stats) | Same licence. A derived table must be offered under ODbL (§4.4). Collective-database and produced-work exceptions apply (§4.5, §4.3). [V, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)] | |

Practical reading [I]:

- Joining CIQUAL/USDA values onto ODbL taxonomy rows produces an ODbL derivative database that also has to keep the CIQUAL and USDA attributions.
- Alternatively, the numbers could live in a separate table under their own licence, joined by code. That reads as a "Collective Database" (ODbL §4.5) and keeps CIQUAL's "unaltered, dated" condition clean, with person corrections stored as a separate layer. The latter also matches the "correction is the last word" design without editing the source rows.
- A recipe total shown to a user is a "Produced Work", so it needs a credit notice, not relicensing.

## Comparison of candidate sources

| Source | Licence | Download size | Foods | Languages | Join path to the OFF ingredients taxonomy (`off_id`) | Piece/portion weights | Update cadence |
|---|---|---|---|---|---|---|---|
| CIQUAL 2025 | Etalab LO 2.0 + ANSES conditions [V] | 1.5 MB xlsx / 1.7 MB XML.7z [V] | 3,484 [V] | FR, EN [V] | **Direct:** `ciqual_food_code` / `ciqual_proxy_food_code` on 1,066 entries (3,962 resolvable with inheritance) [V] | None [V] | 2020 → 2025 (~5 y) [I] |
| USDA SR Legacy | CC0 [V] | 6.7 MB zip / 54 MB CSV [V] | 7,793 [V] | EN | **Direct:** `usda_ndb_code` / proxy on 780 entries, all resolve [V] | **Yes**: 14,449 portions over 7,533 foods [V] | Frozen 2018 [V] |
| USDA Foundation | CC0 [V] | 3.7 MB zip [V] | 395 [V] | EN | `usda_fdc_code` (part of 651 that resolve) [V] | Yes, 10,951 rows [V] | Apr + Oct [V] |
| NEVO 2025/9.0 | RIVM copyright, conditions [V] | n/a (by request) | 2,328 [V] | NL, EN [I] | None in the taxonomy [V] | Not checked | ~2 y [I] |
| CoFID 2021 | UK OGL v3 [V] | 4.4 MB xlsx [V] | 2,898 (+303 old) [V] | EN | None [V] | Not checked | 2021 last [V] |
| Canadian Nutrient File 2026 | OGL-Canada [V] | 26.7 MB zip [V] | 5,993 [V] | EN, FR [V] | Indirect via `USDA_NDB_Code` [V] | Yes (measure conversion) [V] | 2015 → 2026 [V] |
| Frida 5.5 | CC BY 4.0 [V] | 12.3 MB xlsx [V] | >1,000 [V] | DA (+EN docs) [V] | None | Not checked | Irregular [I] |
| OFF taxonomy itself | ODbL [V] | already fetched (2.8 MB) [V] | 5,699 [V] | many [V] | is the key | `average_weight_per_unit` on 45 (537 inherited) [V] | Continuous (git) [V] |
| OFF products (full) | ODbL / DbCL [V] | 1.28 GB csv.gz … 15.9 GB dump [V] | ~4.77 M [V] | many | Products → `ingredients_tags`/`categories_tags`; no per-food numbers [V] | `serving_size`, `product_quantity` (per product) [V] | Nightly [V] |
| OFF products, NL slice | ODbL | ~15–25 MB macro columns [I] | 111,260 [V] | | same | same | must be built [I] |
| OFF products, FR slice | ODbL | ~190–250 MB macro columns [I] | 1,271,194 [V] | | same | same | must be built [I] |
| OFF category stats | ODbL (presumably) | not published [V/?] | categories with ≥10 products per country [V] | | categories, not ingredients [V] | n/a | nightly (private) [I] |

## Open questions (not verified)

1. **Whether OFF exposes its category nutrient stats** (the `.sto` per country) through any public URL or API field beyond each product's `compared_to_category`. I found no export. The category page JSON was not checked because OFF returned 503 during this session.
2. **Real slice sizes.** I did not filter a real dump (by instruction), so all slice sizes are proportional estimates. The UK count failed with 503 each time it was tried.
3. **Delta-export sizes.** `static.openfoodfacts.org` returned 429 on the delta files.
4. **Whether ANSES's "information is not altered" condition** is satisfied when Norish rounds values, maps "traces" or "< x" to numbers, or lets a person override a value. My reading is that it is satisfied if overrides are stored and shown as the person's own data, but that is not settled.
5. **CC BY 4.0 → ODbL** outside the OSM context (relevant to Frida only).
6. **How good the inheritance is.** 70% coverage counts any ancestor with a code, including coarse ones (`en:alcohol` = pure ethanol, "Cheese -average-", "Spice -average-"). How many inherited values are acceptable versus misleading needs a sample review of common recipe ingredients.
7. **Whether OFF's `ingredients_tags` on products uses exactly the ingredients-taxonomy ids** that Norish stores as `off_id`. This is expected from OFF conventions but not checked against a product row.
8. **NEVO's English names and whether NEVO has portion data.** Not checked, since NEVO is excluded on licence grounds anyway.
9. **The `fr.openfoodfacts.org.products.csv` export** is assumed to be the French-labelled world export, based on its 13.3 GB size; not confirmed on a documentation page.
10. **The Hugging Face Parquet's refresh cadence**, which is not stated on the dataset card.
