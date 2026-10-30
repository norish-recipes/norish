# 31: Measure the fixes on the production copy

**What to build:** Ticket 12's run of this release with AI on, again on a fresh clone of `norish_prod_pristine`, once tickets 24 to 30 are done. Before the first start the clone clears every Keep distinct mark, all of them (`update ingredients set kept_distinct = false`), so AI asks those foods too. Mike, 2026-10-21: only on this test clone, never in a person's database or in the product. Read with `measure-12/measure.mjs` and compared against ticket 12's table. The same rules as ticket 12: nothing writes to the template, recipe text stays out of the repo, and every result that looks wrong becomes a ticket of its own.

**The report (Mike, 2026-10-21):** `measure.mjs report` writes one HTML page to read in a browser, from the run files. It holds production text, so it is written outside the repository, beside the private listing, and never published. Three columns side by side: before (the clone with its marks cleared, before the first start), ticket 12's 0.26 AI-on run, and after. Every useful before and after statistic:

- **Foods:** all, own, seeded, flagged, kept distinct, with a parent; spellings, all and own; joined own foods.
- **Flagged foods:** the count by reason, and each flagged food's name, before and after.
- **Recipe lines:** headings, colon lines with a food, lines with no food, one food, several (together and alternatives); groceries, recurring groceries and pantry rows with no food.
- **Hidden:** grocery foods and foods nothing names (ticket 25).
- **AI Changes:** by kind and sure, and each one as food → what it became.
- **The first start:** each cleanup step's count and time, the AI pass's time, and requests and tokens by model.
- **Named cases:** ticket 12's 13 cases and the cases from tickets 24 to 30, each with its lines and foods, and whether the ticket's check now holds.

**Blocked by:** 24, 25, 26, 27, 28, 29, 30

**Status:** done

- [x] The report page is written outside the repository, with the three columns and every statistic above.
- [x] The compare table's counts are in this ticket too; names and lines only in the page.
- [x] Each case from tickets 24 to 30 shows as holding or not, including "salt cinnamon", "koud water melk" and "… reserve eten".
- [x] Flagged foods are counted before and after, by reason, with their names in the page.
- [x] Requests and tokens are counted.

## Implemented (2026-10-21)

- **How:** HEAD aba4ef0d5. A fresh clone `m31_post_on` of `norish_prod_pristine` in `norish-db-local`, every Keep distinct mark cleared on the clone only (129 marks), measured, then booted once from a detached worktree with AI on (the copy's own production config: OpenAI gpt-6-luna, Jev) and its own Redis, and measured again once the review and icon queues had been idle a minute. The clone is left in place. The ticket 12 column re-reads `m12_post_on` now; its AI use and first-start numbers are copied from ticket 12 (its Redis is gone), so its per-model tokens are missing and its 2.1 s covers recheck and cleanup together.
- **Script:** `../measure-12/measure.mjs` gained hidden foods, each flagged food and AI Change, the boot's steps from the server log, job times, tokens per model, the cases from tickets 24 to 30 with their checks, and `report`. `compare` now prints counts only. The run files, the server log and the page are in `~/Documents/norish-ticket-31/` (`report.html`), outside the repo.
- **Time:** the cleanup took 15 s and the server was ready in 26.6 s, against 2.1 s and 6.5 s in ticket 12, but a test run had the machine at load average ~7.7. An AI-off clone booted right after cleaned up in 2.6 s, so this is the load, not a ticket (that clone was dropped). The AI pass asked 134 foods (70 in ticket 12, since the marks are cleared) and took 112 s over 6 jobs; 3 icon jobs drew 9 icons in 85 s.
- **Requests and tokens:** 163 review requests, 231,791 tokens (gpt-6-luna 148 / 224,544, Jev 15 / 7,247), 0 failed; icons 9 requests of gpt-image-1-mini. Jev's 15 against 7 in ticket 12 are ticket 26's second questions for slip-only finds.

**Ingredients**

|               | before | 0.26 AI on (ticket 12) | after |
| ------------- | -----: | ---------------------: | ----: |
| all           |   6426 |                   6351 |  6331 |
| own           |    707 |                    621 |   601 |
| seeded        |   5719 |                   5730 |  5730 |
| flagged       |      4 |                      9 |     7 |
| keptDistinct  |      0 |                    114 |     0 |
| withParent    |   6002 |                   5941 |  5945 |
| ownWithParent |    586 |                    515 |   519 |

**Flagged, by reason**

|                | before | 0.26 AI on (ticket 12) | after |
| -------------- | -----: | ---------------------: | ----: |
| ai-unsure      |      4 |                      9 |     6 |
| ai-unavailable |      – |                      – |     1 |

**Spellings**

|     | before | 0.26 AI on (ticket 12) | after |
| --- | -----: | ---------------------: | ----: |
| all |  71608 |                  71438 | 71409 |
| own |   1904 |                   1382 |  1353 |

**Joined names still a food of their own**

|           | before | 0.26 AI on (ticket 12) | after |
| --------- | -----: | ---------------------: | ----: |
| own foods |     92 |                     32 |    26 |

**Recipe lines**

|                         | before | 0.26 AI on (ticket 12) | after |
| ----------------------- | -----: | ---------------------: | ----: |
| colon line, with a food |     11 |                     11 |     1 |
| heading                 |    164 |                    164 |   164 |
| no food                 |     19 |                     21 |    45 |
| one food                |   6033 |                   5828 |  5805 |
| several, alternatives   |      – |                     63 |    68 |
| several, together       |      – |                    140 |   144 |

**Rows that point at no food**

|                    | before | 0.26 AI on (ticket 12) | after |
| ------------------ | -----: | ---------------------: | ----: |
| groceries          |      0 |                      1 |     0 |
| recurringGroceries |      0 |                      0 |     0 |
| pantryIngredients  |      0 |                      0 |     0 |

**Rows**

|                    | before | 0.26 AI on (ticket 12) | after |
| ------------------ | -----: | ---------------------: | ----: |
| lines              |   6227 |                   6227 |  6227 |
| groceries          |     71 |                     72 |    72 |
| recurringGroceries |      8 |                     11 |    11 |
| pantryIngredients  |      7 |                      7 |     7 |

**Hidden (ticket 25)**

|                     | before | 0.26 AI on (ticket 12) | after |
| ------------------- | -----: | ---------------------: | ----: |
| grocery foods       |      9 |                      6 |     7 |
| foods nothing names |     77 |                     73 |    77 |

**AI Changes**

|                  | before | 0.26 AI on (ticket 12) | after |
| ---------------- | -----: | ---------------------: | ----: |
| merge, sure      |      – |                     20 |    25 |
| merge, unsure    |      – |                      5 |     2 |
| not-a-food, sure |      – |                      3 |    13 |
| parent, sure     |      – |                     19 |    35 |
| parent, unsure   |      – |                      – |     1 |

**The first start**

|                                         | before | 0.26 AI on (ticket 12) | after |
| --------------------------------------- | -----: | ---------------------: | ----: |
| ready, ms                               |      – |                   6500 | 26559 |
| Catalogue cleaned up, ms                |      – |                   2100 | 14964 |
| Catalogue cleaned up: seeded            |      – |                      3 |     3 |
| Catalogue cleaned up: cleaned           |      – |                     86 |    77 |
| Catalogue cleaned up: removed           |      – |                    421 |   430 |
| Catalogue cleaned up: split             |      – |                     59 |    59 |
| Catalogue cleaned up: renamed           |      – |                      6 |     5 |
| Catalogue cleaned up: asked             |      – |                     70 |   134 |
| Seed corrections made, ms               |      – |                      – |   302 |
| Undecided mints looked at again, ms     |      – |                      – |    62 |
| Seed corrections made: moved            |      – |                      – |     5 |
| Seed corrections made: refiled          |      – |                      – |     1 |
| Undecided mints looked at again: merged |      – |                      – |     0 |
| Undecided mints looked at again: filed  |      – |                      – |     1 |

**AI use, ingredient-review queue**

|                                          | before | 0.26 AI on (ticket 12) |        after |
| ---------------------------------------- | -----: | ---------------------: | -----------: |
| jobs                                     |      – |                      4 |            6 |
| requests                                 |      – |                     87 |          163 |
| failed                                   |      – |                      0 |            0 |
| tokens                                   |      – |                  98768 |       231791 |
| job time, s                              |      – |                     53 |          112 |
| first start to last end, s               |      – |                      – |          112 |
| openai · gpt-6-luna, requests / tokens   |      – |                 80 / – | 148 / 224544 |
| typesafe · jev-1.13.0, requests / tokens |      – |                  7 / – |    15 / 7247 |

**AI use, ingredient-icons queue**

|                                              | before | 0.26 AI on (ticket 12) | after |
| -------------------------------------------- | -----: | ---------------------: | ----: |
| jobs                                         |      – |                      2 |     3 |
| requests                                     |      – |                      4 |     9 |
| failed                                       |      – |                      0 |     0 |
| tokens                                       |      – |                      0 |     0 |
| job time, s                                  |      – |                     41 |    85 |
| first start to last end, s                   |      – |                      – |    85 |
| openai · gpt-image-1-mini, requests / tokens |      – |                  4 / – | 9 / 0 |

**The cases** (after; the page has each case's lines and foods in all three columns):

- Holding: "salt cinnamon" and "koud water melk" split into their foods, not deleted (24); "rode pesto" and "sriracha sauce" not merged into red port and oyster sauce, "tortilla's" on tortilla (26); "chocolate whey" keeps whey and "Italian herbs" herb (27); "ground cumin" under cumin, "mango blokjes" under mango (28); "light cooking cream or non-fat Greek yogurt" split into alternatives (29). The new food light cooking cream was then merged into light cream by AI, sure, which reads right.
- Not holding: "chinese 5 spice" lost spice (27, ticket 35); "Nora reserve eten" is hidden and kept, but the recheck filed it under meat (25/28, ticket 33); 1 colon line still names a food (30, ticket 34); "Denta tix" keeps tea (27): it is hidden now (nothing names it), so AI never asks about it. That follows ticket 25 and the 90-day sweep removes it, so not a ticket.
- Ticket 12's cases: "zout en peper", "boter of olie" and "water of kokosmelk" are split; "deegroller" (a tool) and "melted" are deleted, now that their Keep distinct marks are cleared, and their lines keep their text with no food. The 26 more lines with no food are those 16 deleted junk and tool lines and 10 colon lines.

**Results that look wrong, each a ticket:** 32 (AI's parent "jam" found yam by its Croatian spelling), 33 (a singular last word found meat's Turkish "et"), 34 (a colon line on a clean spelling keeps its food), 35 (AI drops 6 parents that are categories: spice, mixed spices, sauce, herb), 36 (3 readings timed out at the 10 s budget, 1 food left flagged, and the ledger misses them).

## Rerun after tickets 32, 33 and 35 (2026-10-22)

- **How:** HEAD 095149606, the same way: fresh clone `m31b_post_on` of `norish_prod_pristine` (129 Keep distinct marks cleared, clone only, left in place), booted once from a detached worktree with AI on (production config) and its own Redis, measured once the queues were idle a minute. The ticket 12 and ticket 31 columns re-read `m12_post_on` and `m31_post_on` (counts unchanged), their AI use and first start copied from their runs. Before is identical to ticket 31's.
- **Load:** average 6.4 to 7.2 during the first start (another process kept the Docker VM busy); ready in 5.1 s, cleanup 2.6 s.
- **Script:** the case texts and lookups moved to a private file outside the repo (`MEASURE_CASES`, default `~/Documents/norish-ticket-31/cases.json`); the script keeps the checks. Page: `~/Documents/norish-ticket-31/report-b.html` (before, ticket 12, ticket 31, now).
- **Cases:** every case from 24 to 30 that held still holds. "chinese 5 spice" keeps spice; Cajun seasoning, harissa kruiden and bagel everything kruiden are under mixed spices, ranch seasoning keeps mixed condiments, adobo sauce keeps sauce (35). bone-in short ribs, nut butter and 3 more still lose their wrong parent; Klop-Fix keeps fish because its reading timed out (36). "Hero Bosvruchtenjam" is under jam (32). "Nora reserve eten" is hidden, with no parent and untouched (33). 1 colon line still names a food (34, open). "Denta tix" keeps tea, hidden, as before.
- **Timeouts (36, open):** 2 readings ran over the 10 s budget, 0 foods left flagged; the log has 147 gpt-6-luna completions, the ledger 145.
- **New:** 37 (a category found a placeholder own food: 1 food filed under it).

**Ingredients**

|               | before | ticket 31 |  now |
| ------------- | -----: | --------: | ---: |
| all           |   6426 |      6331 | 6324 |
| own           |    707 |       601 |  594 |
| seeded        |   5719 |      5730 | 5730 |
| flagged       |      4 |         7 |    6 |
| keptDistinct  |      0 |         0 |    0 |
| withParent    |   6002 |      5945 | 5954 |
| ownWithParent |    586 |       519 |  528 |

**Flagged, by reason**

|                | before | ticket 31 | now |
| -------------- | -----: | --------: | --: |
| ai-unsure      |      4 |         6 |   6 |
| ai-unavailable |      – |         1 |   – |

**Spellings**

|     | before | ticket 31 |   now |
| --- | -----: | --------: | ----: |
| all |  71608 |     71409 | 71409 |
| own |   1904 |      1353 |  1353 |

**Joined names still a food of their own**

|           | before | ticket 31 | now |
| --------- | -----: | --------: | --: |
| own foods |     92 |        26 |  24 |

**Recipe lines**

|                         | before | ticket 31 |  now |
| ----------------------- | -----: | --------: | ---: |
| colon line, with a food |     11 |         1 |    1 |
| heading                 |    164 |       164 |  164 |
| no food                 |     19 |        45 |   44 |
| one food                |   6033 |      5805 | 5804 |
| several, alternatives   |      – |        68 |   71 |
| several, together       |      – |       144 |  143 |

**Rows that point at no food**

|                    | before | ticket 31 | now |
| ------------------ | -----: | --------: | --: |
| groceries          |      0 |         0 |   0 |
| recurringGroceries |      0 |         0 |   0 |
| pantryIngredients  |      0 |         0 |   0 |

**Rows**

|                    | before | ticket 31 |  now |
| ------------------ | -----: | --------: | ---: |
| lines              |   6227 |      6227 | 6227 |
| groceries          |     71 |        72 |   72 |
| recurringGroceries |      8 |        11 |   11 |
| pantryIngredients  |      7 |         7 |    7 |

**Hidden (ticket 25)**

|                     | before | ticket 31 | now |
| ------------------- | -----: | --------: | --: |
| grocery foods       |      9 |         7 |   7 |
| foods nothing names |     77 |        77 |  77 |

**AI Changes**

|                  | before | ticket 31 | now |
| ---------------- | -----: | --------: | --: |
| merge, sure      |      – |        25 |  29 |
| merge, unsure    |      – |         2 |   3 |
| not-a-food, sure |      – |        13 |  13 |
| parent, sure     |      – |        35 |  33 |
| parent, unsure   |      – |         1 |   2 |

**The first start**

|                                         | before | ticket 31 |  now |
| --------------------------------------- | -----: | --------: | ---: |
| ready, ms                               |      – |     26559 | 5076 |
| Seed corrections made, ms               |      – |       302 |   50 |
| Undecided mints looked at again, ms     |      – |        62 |   35 |
| Catalogue cleaned up, ms                |      – |     14964 | 2627 |
| Seed corrections made: moved            |      – |         5 |    6 |
| Seed corrections made: refiled          |      – |         1 |    1 |
| Undecided mints looked at again: merged |      – |         0 |    0 |
| Undecided mints looked at again: filed  |      – |         1 |    0 |
| Catalogue cleaned up: seeded            |      – |         3 |    3 |
| Catalogue cleaned up: cleaned           |      – |        77 |   77 |
| Catalogue cleaned up: removed           |      – |       430 |  430 |
| Catalogue cleaned up: split             |      – |        59 |   59 |
| Catalogue cleaned up: renamed           |      – |         5 |    5 |
| Catalogue cleaned up: asked             |      – |       134 |  134 |

**AI use, ingredient-review queue**

|                                          | before |    ticket 31 |          now |
| ---------------------------------------- | -----: | -----------: | -----------: |
| jobs                                     |      – |            6 |            6 |
| requests                                 |      – |          163 |          162 |
| failed                                   |      – |            0 |            0 |
| tokens                                   |      – |       231791 |       240453 |
| job time, s                              |      – |          112 |           88 |
| first start to last end, s               |      – |          112 |           88 |
| openai · gpt-6-luna, requests / tokens   |      – | 148 / 224544 | 145 / 231928 |
| typesafe · jev-1.13.0, requests / tokens |      – |    15 / 7247 |            – |
| typesafe · jev-1.14.0, requests / tokens |      – |            – |    17 / 8525 |

**AI use, ingredient-icons queue**

|                                              | before | ticket 31 |   now |
| -------------------------------------------- | -----: | --------: | ----: |
| jobs                                         |      – |         3 |     2 |
| requests                                     |      – |         9 |     4 |
| failed                                       |      – |         0 |     0 |
| tokens                                       |      – |         0 |     0 |
| job time, s                                  |      – |        85 |    39 |
| first start to last end, s                   |      – |        85 |    39 |
| openai · gpt-image-1-mini, requests / tokens |      – |     9 / 0 | 4 / 0 |

## Final run after tickets 34, 36 and 37 (2026-10-22)

- **How:** HEAD 0dab43bd8, the same way: fresh clone `m31c_post_on` of `norish_prod_pristine` (129 Keep distinct marks cleared, clone only, left in place), booted once from a detached worktree with AI on (production config) and its own Redis, measured once the queues were idle a minute. Load average 4.0 at the start. Run files, `report-c.html` and a one-page `summary.html` are in `~/Documents/norish-ticket-31/`.
- **First start:** ready in 5.1 s, cleanup 2.6 s; the cleanup cleared 1 colon line (34) and unflagged 1 hidden food.
- **AI pass:** 164 requests (gpt-6-luna 150 / 239,919 tokens, Jev 14 / 6,845), 246,764 tokens, 84 s over 6 jobs, 0 failed, 0 timeouts; the log's 150 completions and 14 Decisions match the ledger (36). Icons: 6 images in 55 s.
- **Counts:** flagged 7 (all ai-unsure; 0 hidden), colon lines with a food 0, no food 45, joined own foods 24. AI Changes: merge 31 sure / 2 unsure, not-a-food 13 sure, parent 32 sure / 2 unsure (of the parent changes, 5 remove a parent).
- **Cases:** every case from 24 to 37 holds but two. One of ticket 26's two cases is merged again into the unrelated food, unsure: the second question picked the slip (38). "Denta tix" keeps tea, hidden, as before (not a ticket). Ticket 37: the one parent change onto an own food is AI's parent, not a category.
- **New:** 38 (the second question picks an unrelated slip), 39 (an other name AI gives merges, sure, into a different seeded product: 1 food).

## Run after tickets 32-48 (2026-10-22)

- **How:** HEAD fa3fb4295, the same way: fresh clone `m48_post_on` of `norish_prod_pristine` (129 Keep distinct marks cleared, clone only, left in place), booted once from a detached worktree with AI on (production config) and its own Redis, measured once both queues were idle a minute. Load average 3.4 at the start. Run files, `report-48.html` and `summary-final.html` are in `~/Documents/norish-ticket-31/`. The script gained generic checks (`linesName`, `linesNot`, `noSpelling`, `sameFood`) for the cases of tickets 38-48, and lists spelling changes.
- **First start:** ready in 5.9 s, cleanup 3.5 s (split 57, unmarked 462 confirmed parents), junk pile seeded 211, 252 seeded foods queued for the spelling check.
- **AI pass:** 922 requests (gpt-6-luna 860 / 1,161,370 tokens, Jev 62 / 34,424), 1,195,794 tokens, 344 s over 19 jobs, 0 failed, 0 timeouts; the log's 860 completions match the ledger. First pass 559 foods, 636 requests; spelling check 252 requests, 164,363 tokens, 51 s. Icons: 16 images in 152 s.
- **Counts:** own foods 478 (last run 595), flagged 22 (all ai-unsure; 9 are targets of unsure merges), colon lines with a food 0, no food 50 (5 more, all right), joined own foods 10. AI Changes: merge 130 sure / 9 unsure, parent 59 / 4, parent removed 17 / 0, not-a-food 15, plain name 2, spelling removed 8, spelling moved 1; 35 splits by AI.
- **Cases:** every case from 24 to 48 holds but four: one ticket 40 case is merged, sure, into the wrong seeded food (49); one split still drops the word its parts share (41's rule does not reach it); ticket 45's case is not split, AI unsure, flagged (its wrong food is gone); ticket 27's hidden case keeps its parent, as before. Ticket 44: 28 of the 29 joined foods are split or merged as one; 1 is read as one food.
- **Crap left** (listed own foods, judged as the audit did): 27 of 389, against 99 of 511 last run. Still joined 2 (29), near-duplicates 8 (40), wrong parent 6 (18), missing parent 7 (4), splits on a wrong food 3 (7), seeded foods with a wrong spelling 7 (12), note spellings 162 (167), brands merged into their general food 9 (0).
- **New:** 49 (a food's words merge it, sure, into another seeded food: 1 food, 7 lines), 50 (brands merged into the general food: 9), 51 (the spelling check undoes a same-start merge: 1, and moves a comma fragment: 1), 52 (seed spellings that name another food: 2), 53 (a right parent dropped: 2, a category on a wrong food: 1).

## Run after tickets 50 and 54 (2026-10-22)

- **How:** HEAD c93158c4f, the same way: fresh clone `m54_post_on` of `norish_prod_pristine` (129 Keep distinct marks cleared, clone only, left in place), booted once from a detached worktree with AI on (production config) and its own Redis, measured once both queues were idle a minute. Load average 3.7 at the start. A first attempt was dropped and redone from a fresh clone: the Mac went into maintenance sleep 8 s into the AI pass (285 s), which timed out requests; the server now runs under `caffeinate -ims`. Run files, `report-54.html` and `summary-54.html` are in `~/Documents/norish-ticket-31/`. The script gained a `notFlagged` check for ticket 54's cases; the private cases file gained ticket 50's and 54's.
- **First start:** ready in 4.8 s, cleanup 3.5 s, every cleanup count as last run.
- **AI pass:** 894 requests (gpt-6-luna 848 / 1,161,343 tokens, Jev 46 / 25,174), 1,186,517 tokens, 402 s over 13 jobs, 0 failed, 0 timeouts; the log's 848 completions match the ledger. First pass 618 requests in 286 s; spelling check 252 requests, 164,393 tokens, 57 s. Icons: 15 images in 143 s.
- **Counts:** own foods 477 (last run 478), flagged 20 (22): 4 targets of unsure merges, 5 unsure parents, 11 left as they were. Colon lines with a food 0, no food 49, joined own foods 9. AI Changes: merge 131 sure / 4 unsure, parent 58 / 5, parent removed 14 / 0, not-a-food 15, spelling removed 5, spelling moved 1; 35 splits by AI.
- **Cases:** ticket 54's hold (the three slip merges are sure, nothing flagged). Ticket 50's: 6 of 8 hold; the 2 that do not are its open root cause 2 (the general food held the specific spelling in 0.25). Ticket 49's red pepper flakes holds. Three checks that held last run do not now, each an unsure reading left as it was and flagged: 1 of ticket 35's wrong parents, 2 of ticket 44's joined foods. As before: 1 split drops the shared word (41), ticket 45's case unsplit, ticket 27's hidden case.
- **Crap left** (judged as last run; last run's judgement kept for own foods that did not change): 36 of 388, against 27 of 389. Still joined 3 (2), near-duplicates 12 (8), wrong parent 8 (6), brand with no parent 1 (2), missing parent 10 (7), specific food merged into its general food 6 (8), splits on a wrong food 2 (3), seeded foods with a wrong spelling 7 (7), note spellings 163 (162). Most of the rise is AI reading a food differently from last run.
- **New:** 55 (a language model's sure pick overrides a Decision that doubted it: 3 foods, 5 lines). 4 more dropped parents fit 53, 1 more general-food merge fits 50's root cause 2.

## Run after ticket 56 (2026-10-22)

- **How:** HEAD 44297d433, the same way: fresh clone `m56_post_on` of `norish_prod_pristine` (129 Keep distinct marks cleared, clone only, left in place), booted once from a detached worktree under `caffeinate -ims` with AI on (production config) and its own Redis, measured once both queues were idle a minute. Load average 2.1 at the start. A first attempt was dropped and redone from a fresh clone: Next.js stopped the dev server 2 s into the AI pass to show an upgrade notice to an agent (a retry continues past it). Run files, `report-56.html` and `summary-56.html` are in `~/Documents/norish-ticket-31/`; the private cases file gained ticket 55's and 56's cases (italian sausage now checks "under sausage").
- **First start:** ready in 4.7 s, cleanup 3.5 s, every cleanup count as last run.
- **AI pass:** 886 requests (gpt-6-luna 857 / 873,893 tokens, Jev 29 / 15,919), 889,812 tokens (last run 1,186,517), 529 s over 18 jobs, 1 failed: one reading timed out, was asked once more and answered; the log's 857 sent = 856 completed + 1 failed = the ledger. By prompt, from the log: reading 579 / 698,706 (last run 573 / 977,068), match 6 / 3,528 (10 / 13,632), spelling check 252 / 162,357, plain name 19 / 9,302. First pass 336 s, spelling check 73 s. Icons: 20 images in 189 s.
- **Counts:** own foods 532 (last run 477), listed own foods 443 (388), flagged 21 (20): 3 targets of unsure merges, 5 unsure parents, 13 left as they were. Colon lines with a food 0, no food 51, joined own foods 10. AI Changes: merge 81 sure / 3 unsure (131 / 4), parent 77 / 4, parent removed 20 / 1, not-a-food 17, plain name 3, spelling removed 5; 35 splits by AI.
- **Cases:** all of ticket 56's hold (its 3 specific foods under their parent, the specific-broccoli case and its copy, the chili case, the brioche case sure). Three checks that held last run do not now: 1 of ticket 24's splits (AI unsure, kept whole, flagged), ticket 28's ground spice case (its food lost its specific parent for the category spice), ticket 50's brand merges (1 right, 1 onto the wrong food, 4 kept under the general food). As before: ticket 35's one unsure wrong parent, 1 split drops the shared word (41), ticket 45's case unsplit, ticket 27's hidden case, ticket 50's 0.25 spelling, 51/52/53 not built.
- **Crap left** (judged as last run): 83 of 443, against 36 of 388. Still joined 3 (3), near-duplicates 54 (12), wrong parent 10 (8), brand with no parent 2 (1), missing parent 13 (10), specific food merged into its general food 0 (6), splits on a wrong food 4 (2), seeded foods with a wrong spelling 8 (7), note spellings 163 (163). Also 4 brands kept under their general food and 14 parents loosened to spice, not counted. The rise is near-duplicates: the new reading gives other names for 29% of foods (71% last run), and 4 more by ticket 56's rule.
- **Run to run:** of the 232 foods AI changed in m54, 134 got the same change now, 5 the same with the other sureness, 39 a different change, 54 none; m48 to m54 was 164 of 242, 6, 35, 37. Of 573 names read in both runs: same kind 571, same sureness 562, same parent and category 460 (487 m48 to m54).
- **New:** 57 (AI's English name is the parent it gives: 4 foods, 8 lines, and 4 brands), 58 (the lean reading prompt gives fewer other names and broader parents: 39 near-duplicates, 14 parents loosened to spice), 59 (a split part read again alone and deleted: 1 food, 1 line). 2 more seed-spelling results fit 52, 1 merge undone and redone fits 51, 8 dropped parents fit 53.

## Run after tickets 57, 58 and 60 (2026-10-22)

- **How:** HEAD 67eb2082a, the same way: fresh clone `m60_post_on` of `norish_prod_pristine` (129 Keep distinct marks cleared, clone only, left in place), booted once from a detached worktree under `caffeinate -ims` with AI on (production config) and its own Redis, measured once both queues were idle a minute. Load average 1.6 at the start. The server was started once before on a throwaway AI-off clone (dropped) so Next.js's upgrade notice stopped that start, not the run. Run files, `report-60.html` and `summary-60.html` are in `~/Documents/norish-ticket-31/`; the private cases file gained ticket 57's and 58's cases, and the m54/m56 columns re-read their clones for them.
- **First start:** ready in 4.8 s, cleanup 3.6 s, every cleanup count as the last two runs.
- **AI pass:** 891 requests (gpt-6-luna 859 / 850,369 tokens, Jev 32 / 17,969), 868,338 tokens (last run 889,812), 359 s over 19 jobs (529), 0 failed, 0 timeouts; the log's 859 completions match the ledger. By prompt, from the log: reading 580 / 673,092 (last run 579 / 698,706), match 10 / 5,642, spelling check 252 / 163,464 in 54 s, plain name 17 / 8,171. First pass 229 s. Icons: 18 images in 162 s.
- **Counts:** own foods 506 (last run 532), listed own foods 417 (443), flagged 16 (21): 1 target of an unsure merge, 3 unsure parents, 3 slips AI's second question doubted, 9 left as they were. Colon lines with a food 0, no food 51, joined own foods 10. AI Changes: merge 110 sure / 1 unsure (81 / 3), parent 60 / 3, parent removed 16 / 0, not-a-food 17, plain name 1, spelling removed 7; 35 splits by AI.
- **Other names:** given for 46% of foods read (m54 71%, m56 29%). Category spice 13 times (24, m54 7). Parents moved to spice against m54: 8 (14), no powder among them.
- **Cases:** ticket 57's hold (its 4 foods and kippendijen merge, 3 of 4 brands merge into their general food); ticket 58's powders keep their specific parent; ticket 56's pumpkin puree, italian sausage and Tenderstem broccoli hold; ticket 24's and 28's that failed last run hold again. One check that held last run does not now: ticket 42's salam case is a second own food. Not holding as before: 1 of ticket 35's wrong parents back (AI gave it) plus its unsure one, 2 of ticket 44's joined foods read unsure and kept whole (2 others split now), ticket 45's case, ticket 41's shared-word split, ticket 50's 0.25 spelling and 1 brand kept under its general food, 51/52/53/59 not built, ticket 27's hidden case. Ticket 60's plain name made 1 rename, case only (62).
- **Crap left** (judged as last run): 64 of 417, against 83 of 443 last run and 36 of 388 in m54. Still joined 3 (3), near-duplicates 37 (54), wrong parent 5 (10), brand with no parent 3 (2), missing parent 14 (13), tool 1, note 1 (0), specific food merged into its general food 0 (0), splits on a wrong food 5 (4), seeded foods with a wrong spelling 10 (8), note spellings 162 (163). Also 1 brand kept under its general food (4) and 8 parents loosened to spice (14), not counted.
- **Run to run:** of the 232 foods AI changed in m54, 154 got the same change now, 0 the same with the other sureness, 33 a different change, 45 none (m54 to m56: 134, 5, 39, 54). Of 572 names read in both m54 and now: same kind 568, same sureness 562, same parent and category 471 (459 m54 to m56, counted the same way).
- **New:** 61 (an unsure "not a food" deletes a real food: 1 food, 1 line), 62 (a plain name differing only in case renames: 1 food), 63 (an other name that is the parent's spelling keeps the same food under it: 1 food, 3 lines), 64 (other names still missing for 54% of foods: 6 new near-duplicates, 11 lines, and 18 of ticket 58's 39 still). 1 merge undone and redone twice fits 51, 2 seed-spelling results fit 52, 1 dropped parent fits 53, 1 deleted split part fits 59, 1 merge fits 39.

## Run after tickets 61-64 (2026-10-23)

- **How:** HEAD f7bdd8ae3, the same way: fresh clone `m64_post_on` of `norish_prod_pristine` (129 Keep distinct marks cleared, clone only, left in place), booted once from a detached worktree under `caffeinate -ims` with AI on (production config) and its own Redis, measured once both queues were idle a minute. Load average 1.9 at the start. The server was started once before on a throwaway AI-off clone (dropped) for Next.js's upgrade notice. Run files, `report-64.html` and `summary-64.html` are in `~/Documents/norish-ticket-31/`; the private cases file gained cases for tickets 61-63, and the m54/m60 columns re-read their clones for them.
- **First start:** ready in 4.8 s, cleanup 3.6 s, every cleanup count as the runs since m48.
- **AI pass:** 920 requests (gpt-6-luna 859 / 873,008 tokens, Jev 61 / 35,024), 908,032 tokens (last run 868,338), 550 s over 19 jobs (359), 0 failed, 0 timeouts; the log's 859 completions match the ledger. By prompt, from the log: reading 578 / 694,068, match 12 / 6,716, spelling check 252 / 164,070 in 68 s, plain name 17 / 8,154. First pass 344 s (229) for 6% more output tokens a reading: provider time. Icons: 19 images in 170 s.
- **Counts:** own foods 487 (last run 506), listed own foods 398 (417), flagged 22 (16): 3 unsure not-a-food readings kept (61), 2 targets of unsure merges, 5 unsure parents, 4 doubted slips, 8 left as they were. Colon lines with a food 0, no food 51, joined own foods 10. AI Changes: merge 127 sure / 2 unsure (110 / 1), parent 65 / 3, parent removed 15 / 2, not-a-food 15 (17), plain name 2, spelling removed 8; 36 splits by AI.
- **Other names:** given for 94% of foods read (m54 71%, m56 29%, m60 46%). Category spice 10 times (13). Parents moved to spice against m54: 7 (8), no powder among them. Ticket 63's rule fired on 7 readings, all right merges.
- **Cases:** every check of tickets 61-64 holds: the unsure gibberish reading is kept and flagged and its line names it, no case-only rename, the case's capital kept, the parent-spelling case merges, other names above 46%; ticket 59's part is kept and flagged now. 17 checks fail (18): six that held last run do not now, three by the check's letter only (a form merged into its seeded food, a puree merged into a seeded twin, one line on a seeded twin), and three real: ticket 24's joined case read unsure and kept whole, a ticket 50/56 yogurt merged into its general food by its 0.25 spelling, and a ticket 57 brand read as another product whose parent is not in the catalogue.
- **Crap left** (judged as last run): 51 of 398, against 64 of 417 last run and 36 of 388 in m54. Still joined 3 (3), near-duplicates 25 (37), wrong parent 5 (5), brand with no parent 4 (3), missing parent 12 (14), gibberish 1 (0), note 0 (1), tool 1 (1). Not in the total: splits on a wrong food 5 (5), seeded foods with a wrong spelling 7 (10), note spellings 162 (162), specific food merged into its general food 2 (0), 1 brand kept under its general food (1), 7 parents loosened to spice (8).
- **Run to run:** of the 232 foods AI changed in m54, 166 got the same change now, 3 the same with the other sureness, 31 a different change, 32 none (m54 to m60: 154, 0, 33, 45). Of 571 names read in both m54 and now: same kind 567, same sureness 556, same parent and category 468 (471). Of 575 read in both m60 and now: 571, 564, 504.
- **New:** 65 (AI's one-word parent is another food's name, a vegetable filed under a spice: 1 food, 4 lines), 66 (near-duplicates stay although other names are given: 5 foods, 9 lines; 25 near-duplicates in all). 2 merges fit 39, 1 seed spelling fits 52, 1 yogurt merge fits 50's root cause 2, 5 parents not found fit 53, 1 spelling removal fits 51 (right this time).

## Run after tickets 51-53, 65, 67, 68 and ticket 60's round 2 (2026-10-23)

- **How:** HEAD 814c23937, the same way: fresh clone `m68_post_on` of `norish_prod_pristine` (129 Keep distinct marks cleared, clone only, left in place), booted once from a detached worktree under `caffeinate -ims` with AI on (production config) and its own Redis, measured once both queues were idle a minute. Load average 2.4 at the start. The server was started once before on a throwaway AI-off clone (dropped) for Next.js's upgrade notice. Run files, `report-68.html` and `summary-68.html` are in `~/Documents/norish-ticket-31/`; the private cases file gained cases for tickets 51-53, 65 and 67, and the m54/m64 columns re-read their clones for them.
- **First start:** ready in 4.9 s, cleanup 3.7 s. Seed corrections moved 8 (6: ticket 52's two), the cleanup split 58 (57) and unmarked 461 (462), every other count as the runs since m48.
- **AI pass:** 913 requests (gpt-6-luna 855 / 872,262 tokens, Jev 58 / 32,319), 904,581 tokens (last run 908,032), 421 s over 16 jobs (550), 0 failed, 0 timeouts; the log's 855 completions match the ledger. By prompt, from the log: reading 575 / 688,323, match 12 / 6,996, spelling check 252 / 169,418 in 58 s (3% more tokens for the recipe line each spelling now shows), plain name 16 / 7,525. First pass 274 s. Icons: 18 images in 174 s.
- **Counts:** own foods 491 (last run 487), listed own foods 402 (398), flagged 22 (22): 3 unsure not-a-food readings kept, 3 targets of unsure merges, 8 unsure parents, 8 left as they were, 0 doubted slips (4). Colon lines with a food 0, no food 52 (51: the Papaver line, 72), joined own foods 9 (10). AI Changes: merge 120 sure / 3 unsure (127 / 2), parent 57 / 7, parent removed 14 / 1, not-a-food 15, plain name 2, spelling removed 6; 35 splits by AI.
- **Other names:** given for 94% of foods read (94%). Category spice 11 times (10). Parents moved to spice against m54: 4 (7). Ticket 63's rule fired on 6 readings, 4 right merges; ticket 68's slip check on 3: 1 right, 2 wrong (69).
- **Cases:** 65 holds (red pointed peppers under red bell pepper again). 52 holds: all 5 drumstick lines name a new own chicken drumsticks food (2 together with chicken thigh as alternatives), French "steak" is on beef steak and nothing is under patty. 51 holds as built: the spelling check left the spellings a merge moved onto noodle, and "organic plain" stays on the greek yogurt food; but the noodle merge is wrong this time (71). 53 is not reached on a first start, as expected: lean chicken mince keeps kipgehakt and unflavored protein powder is under protein powder because AI named those parents this time, and 4 foods lose a parent whose name finds nothing (nut butter, bone-in short ribs, a plant milk, a spice brand). 67 has no case on the copy: no own food is named in capitals only after the run (the one heading in capitals is deleted, sure). 68 merged the guajillo case rightly and two broccoli foods wrongly (69). 14 checks fail (18 on the same table): new are the two broccoli foods (69) and two that fail only the letter (baby potatoes merged into the seeded new potato); fixed are koud water melk, mango blokjes, Klop-Fix off fish (now mixed spices, still wrong), pumpkin puree, edamame, 51, 52 and 65.
- **Crap left** (judged as last run): 55 of 402, against 51 of 398 last run and 36 of 388 in m54. Still joined 2 (3), near-duplicates 30 (25), wrong parent or food 6 (5), brand with no parent 4 (4), missing parent 11 (12), gibberish 1 (1), tool 1 (1). Not in the total: specific food merged into its general food 2 (2), brand kept under its general food 2 (1), parents loosened to spice 4 (7), splits on a wrong food 4 (5), seeded foods with a wrong spelling 8 (7), note spellings 162 (162). The rise is near-duplicates: 8 merge now and 13 that merged rightly last run are own foods again (66's shape); without them 25 (26).
- **Run to run:** of the 236 foods AI changed in m64, 161 got the same change now, 4 the same with the other sureness, 34 a different change, 37 none. Of the 232 changed in m54: 160, 3, 32, 37 (m54 to m64: 166, 3, 31, 32). Of 573 names read in both m64 and now: same kind 570, same sureness 561, same parent and category 493 (86%; m60 to m64 88%).
- **New:** 69 (an other name a slip from the parent is another food: 2 foods merged into broccoli, 4 lines), 70 (a parent merged away while the reading is out is dropped: 1 food, 1 line), 71 (a merge takes along a spelling AI never read, and the spelling check now leaves it: 1 food, 1 line), 72 (the spelling check reads a seeded food's Dutch name as not a food: 1 spelling, 1 line). 13 returned near-duplicates fit 66, 4 parents found nothing fit 53 (expected on a first start), 1 passata merge fits 39 (wontfix).

## Two runs of the same code, after tickets 69 and 70 (2026-10-23)

- **How:** HEAD cce7f83de, run twice the same way, one after the other: fresh clones `m70a_post_on` then `m70b_post_on` of `norish_prod_pristine` (129 Keep distinct marks cleared, clones only, left in place), each booted from one detached worktree under `caffeinate -ims` with AI on (production config) and its own fresh Redis, measured once both queues were idle a minute. Load average 2.5 and 2.2 at the start. Before each run the server was started once on a throwaway AI-off clone (dropped) for Next.js's upgrade notice. Run files, `report-70.html`, `summary-70.html` and `compare-70.md` are in `~/Documents/norish-ticket-31/`; the private cases file gained ticket 70's case.
- **First start:** a 5.0 s / cleanup 3.8 s, b 4.9 s / 3.8 s; every cleanup count identical in a, b and m68.
- **AI pass:** a 908 requests (gpt-6-luna 853, Jev 55), 904,226 tokens, 494 s over 16 jobs; b 911 (851, 60), 906,332 tokens, 402 s over 15 jobs. 0 failed, 0 timeouts in both; each log's completions match its ledger. Icons 18 and 16 images.
- **Counts:** own foods 489 / 491, listed own foods 400 / 402, flagged 22 / 26 (12 in both). Other names for 96% / 94% of foods read. AI Changes: merge 125 / 1 and 123 / 3 (sure / unsure), parent 70 / 5 and 70 / 3, not-a-food 15 each.
- **Tickets 69 and 70 hold in both runs:** the Bimi line merges into the Tenderstem broccoli food, which stays under broccoli; biefstukpuntjes is under beef steak. Ticket 69's chosen cost shows in both: guajillo peppers stays an own food under guajillo chili (63's check fails again). Checks: a 65 hold / 11 fail, b 66 / 10, m68 64 / 12, m54 60 / 16 (76 checks, all columns read under today's cases file).
- **Crap left, one judge for every column:** a 76, b 84, m68 77, m54 74 (published: m68 55, m54 36). Near-duplicates 34 / 37 / 38 / 34, wrong parent or food 8 / 11 / 9 / 10, still joined 3 / 6 / 3 / 3, brand with no parent 5 / 5 / 4 / 2, missing parent 23 / 23 / 21 / 23, tool, note and gibberish 3 / 2 / 2 / 2. Every listed own food of a and of b was judged by written rules (in the page); m68 and m54 take a's or b's verdict where a food is in the same state and were judged by hand for the rest (46 and 39 foods). Of the 332 listed own foods identical in a and b, 0 got different verdicts; 1 verdict was corrected while re-judging m54 (a brand cooking cream merged into margarine is wrong, in a and m68). The stricter rules count no-parent foods with an obvious parent, own twins and wrong merges that the carried-forward judging let pass, so the published 36 and 55 are not comparable to these.
- **Noise band:** on the same code the crap count moves by 8 (76 / 84) and near-duplicates by 3 (34 / 37). Behind that, 42 foods are crap in one run and fine in the other (17 a only, 25 b only) and 4 change kind; 13 flip in or out of near-duplicates. Of 220 foods AI changed in a, 176 got the same change in b (80%); of 573 names read in both, 498 got the same parent and category (87%). m68 → a was 168 of 224 (75%) and 501 of 574.
- **Conclusion:** m68 → now (77 → 76 / 84) and m54 → now (74 → 76 / 84) are inside the band: with one judge, nothing from m54 to now moved the crap count measurably. Ticket 69 and 70 work but touch 4 foods. A single run tells about ±8 foods; the rises and falls reported since m54 were mostly judging and run variance.
- **New:** none. Every wrong result found in both runs fits an existing ticket: 71 (the noodle merge), 39 (passata), 66 (near-duplicates whose other names are not the catalogue's spelling), 53's shape (parents that find nothing), 69's chosen cost (guajillo), 35's whipped-cream stiffener (wrong in both, in two different ways). An unsure "patty" parent on one steak is flagged in both, as designed.

## Two runs after ticket 66's family question (2026-10-23)

- **How:** HEAD 9da73a9fc (m70's code plus ticket 63's comparison through `sameFood`/`wholeFoodKey`, ticket 66's family question, ticket 73 wontfix, a flag refactor), run twice the same way as m70, one after the other: fresh clones `m74a_post_on` then `m74b_post_on` of `norish_prod_pristine` (129 Keep distinct marks cleared, clones only, left in place), each booted from one detached worktree under `caffeinate -ims` with AI on (production config) and its own fresh Redis, measured once both queues were idle a minute. Load average 2.2 and 2.1 at the start. Before each run the server was started once on a throwaway AI-off clone (dropped) for Next.js's upgrade notice. Run files, `report-74.html`, `summary-74.html`, `compare-74.md` and the verdicts `v74a.json`/`v74b.json` are in `~/Documents/norish-ticket-31/`.
- **First start:** a 5.0 s / cleanup 3.8 s, b 4.9 s / 3.7 s; every cleanup count as in m70.
- **AI pass:** a 1,503 requests (gpt-6-luna 1,096, Jev 407), 1,470,291 tokens, 437 s over 15 jobs; b 1,509 (1,097, 412), 1,476,473 tokens, 478 s over 16 jobs. 0 failed, 0 timeouts; each log's completions match its ledger. Against m70: +595 / +598 requests and +63% tokens. Ticket 66 expected 330-380 more Decision requests: Jev is +352, and the language model's match question went from 8 / 10 to 262 / 263, because the Decision falls below 0.8 for most family questions. Icons 14 and 17 images.
- **Counts:** own foods 364 / 356 (m70 489 / 491), listed own foods 275 / 267 (400 / 402), flagged 98 / 94 (22 / 26). AI Changes: merge 232 / 18 and 242 / 15 (sure / unsure; m70 125 / 1, 123 / 3), parent 44 / 12 and 45 / 13, not-a-food 14 each. Other names for 95% of foods read in both.
- **Named cases, both runs:** guajillo peppers merges into guajillo chili (ticket 63's check holds again); Tenderstem broccoli and Bimi stay one own food under broccoli, not merged into it; biefstukpuntjes is under beef steak. Checks: a 61 hold / 15 fail, b 61 / 15 (m70a 64 / 11 with 1 not measured, m70b 66 / 10). The new failures in both runs are ticket 50 and 56's cases: baby potatoes, mini-krieltjes and edamame boontjes fail only the check's letter, and canned petite diced tomatoes and deli ham are merged into their general food. In b, italian sausage is merged into sausage, which is ticket 56's own example.
- **Crap left, the same judge as m70:** a 57, b 52 (m70 76 / 84, 0.25 331). Near-duplicates 16 / 12 (34 / 37), wrong parent or food 8 / 12 (8 / 11), still joined 3 / 3 (3 / 6), brand with no parent 4 / 4 (5 / 5), missing parent 23 / 18 (23 / 23), tool, note and gibberish 3 / 3 (3 / 2). Foods in the same state as in m70a, m70b or 0.25 took that verdict (185 / 179), and so did AI changes identical to an m70 change (126 / 125). The rest (90 foods and 138 changes in a, 88 and 146 in b) were judged by summary-70's rules, b independently of a. Of 169 listed own foods and 216 AI changes identical in a and b, 0 got different verdicts. 2 of a's verdicts were fixed while judging b: the seeded "pepper mix" is a peppercorn blend, so a's two bell-pepper merges into it are wrong. One b merge left no AI Change row: its target, a joined food, was split afterwards. It was found in the job log and counted as wrong.
- **Not in the total, as in m70: a specific food merged into its general food.** There are 51 in a and 54 in b (m70: 0 and 1), 31 of them the same food in both runs, and 81 / 96 recipe lines now name the general food. Most are the family question answering "this item" for the parent itself: cultivars, cuts, dried, canned and frozen forms, flavours (Maris Piper into potato, genoa salami into salami, dried dill into dill). Counted as wrong, the totals are 108 / 106 against 76 / 85.
- **Noise band:** a and b differ by 5, and 36 foods are crap in one run and fine in the other (m70 42). Of 325 foods AI changed in a, 236 got the same change in b (73%; m70 80%). 501 of 573 readings got the same parent and category (87%, as in m70).
- **Family question (b, from the job logs; a's Redis was removed before they were read):** it made 123 merges: 75 right, 45 a specific food into its general food, and 3 wrong. The wrong ones, all b only: sweet chili sauce into stir-fried sauce, Blue Band Finesse into margarine, and fat free plain greek yogurt into a joined cream-or-yogurt food that was then split, so its 4 lines now also name light cream.
- **Conclusion:** ticket 66 moves near-duplicates clearly outside the m70 band (34 / 37 → 16 / 12), and the total with them (76 / 84 → 57 / 52). The share of crap among listed own foods stays about 20% (21% / 19%, m70 19% / 21%): there are about 125 fewer own foods a run to be crap. And by the same mechanism it merges about 50 specific foods a run into their general food, which tickets 50 and 56 ruled a food of its own. That class sits outside the count, so the drop is real only if those merges are accepted. Cost: about 600 requests and 0.57M tokens more a run, and about 70 more flagged foods.
- **New:** 74 (the family question merges a specific food into its general food: 31 foods in both runs) and 75 (its unsure "none" flags rightly filed foods: 31 foods flagged in both runs and in neither m70 run). Every other wrong result in both runs fits an existing ticket: 71 (Verstegen noedels), 39 (passata), 35 (Klop-Fix), 53's shape and 73 (parents that find nothing).

## Final run, AI on and AI off, after tickets 63, 71 and 76 (2026-10-23)

- **How:** HEAD 235ed6571 (m70's code plus ticket 63's comparison through `sameFood`/`wholeFoodKey`, ticket 66 taken out, tickets 76 and 71, two flag refactors). Two fresh clones of `norish_prod_pristine` (129 Keep distinct marks cleared, clones only, left in place): `m76_post_on` with AI on (production config) run fully first, then `m76_post_off` with AI off (`enabled: false` and the encrypted config cleared, as ticket 12). Each booted once from one detached worktree under `caffeinate -ims` with its own fresh Redis, measured once both queues were idle a minute; the job logs were dumped before Redis was removed. Load average 1.8 and 2.3 at the start. Before each run the server was started once on a throwaway AI-off clone (dropped) for Next.js's upgrade notice. Run files, `report-76.html`, `summary-76.html`, `compare-76.md` and the verdicts `v76on.json`/`v76off.json` are in `~/Documents/norish-ticket-31/`.
- **First start:** both ready in 4.9 s, cleanup 3.8 s; every cleanup count as in m70. AI off sends 0 requests and leaves the 252 added seeded spellings for a start with AI on.
- **AI pass:** 891 requests (gpt-6-luna 848, Jev 43), 1,042,854 tokens (m70 904,226 / 906,332), 667 s over 15 jobs (494 / 402). 1 request timed out and was asked again; the log's 848 sent match the ledger. The reading prompt's tokens rose 21% (836,973 against 690,293 in m70a, 574 / 576 readings): the parents lists. Icons 13 images.
- **Counts:** AI on: own foods 482, listed own foods 393, flagged 22. AI Changes: merge 128 sure / 3 unsure, parent 67 / 8, not-a-food 15, spelling removed 7. AI off: own foods 648, listed 559, flagged 3, joined own foods 35 (0.25: 92), colon lines with a food 0 (11).
- **Crap left, the same judge as m70:** 0.25 331, AI off 268, m70a 76, m70b 84, AI on 73. Near-duplicates 146 / 144 / 34 / 37 / 34, wrong parent or food 32 / 31 / 8 / 11 / 7, still joined 90 / 34 / 3 / 6 / 2, brand with no parent 7 / 7 / 5 / 5 / 5, missing parent 34 / 35 / 23 / 23 / 23, tool, note and gibberish 22 / 17 / 3 / 2 / 2. Share of listed own foods 53% / 48% / 19% / 21% / 19%. Specific food merged into its general food: 1 (m74: 51 / 54). AI on took 347 of 393 food verdicts and 139 of 146 change verdicts from an identical state in m70a, m70b, m74a, m74b or 0.25 (0 conflicts); AI off took 550 of 559.
- **AI off against 0.25:** 61 crap foods fixed, 0 made worse. Joined names split 53 of 90 (zout en peper, salt & pepper, boter of olie), notes off 5 of 11 (foods only a heading or colon line named), 2 joined near-duplicates split, Cajun seasoning off its wrong parent. Near-duplicates, parents, tools and brands do not move without AI, as designed.
- **Ticket 76:** mager kipgehakt under kipgehakt, ovenfriet zoete aardappel under zoete aardappel friet, burger buns under bread roll, harissa kruiden, mexicaanse kruiden and taco seasoningmix under the seeded mixed condiments ("seasoning mix"), chicken bouillon cube and paddenstoelenbouillontablet under broth, both dressings under dressing. Not reached: bao buns and Maggi bouillonblokje have no parent; the vegetable and beef bouillon cubes lost broth (79). zoetzure rode ui was filed under ingelegde rode ui, then ingelegde rode ui merged into it: both lines name one food under red onion (twins, not counted). Of the 32 foods missing a parent in m70a or m70b, 16 have the right parent, 12 still none, 2 a wrong one (gyoza vellen under casing, 78), 2 merged away.
- **Ticket 71:** the Verstegen line is off noodle (its own food under mixed condiments, flagged), but AI read the short name as a seasoning this time, so no merge was there for 71 to follow. 71 did fire on spicy salsa's merge into hot sauce: the carried spelling was checked and taken off. guajillo peppers merges into guajillo chili, Tenderstem broccoli and Bimi are one own food under broccoli, biefstukpuntjes is under beef steak.
- **Checks:** 0.25 35 hold / 41 fail, AI off 41 / 35, m70a 64 / 11, m70b 66 / 10, AI on 66 / 10. Newly failing: Hero Bosvruchtenjam no longer under jam (77).
- **Conclusion:** AI on is inside the m70 band (73 against 76 / 84); AI off only removes problems. Against 0.25, AI on fixes 252 of 331 and makes 6 worse: three lost parents through 79, two empty parent lists (candlenuts, protein powder), the passata merge (39). The m70 regressions Verstegen noedels, sambal manis, ovenfriet zoete aardappel, mager kipgehakt and zoetzure rode ui are fine now.
- **New:** 77 (a first parent that finds only a doubtful food ends the lookup: 1 food), 78 (a broad native parent before a specific English one: 4 foods, 7 lines), 79 (AI's parents leave out the general food and a right parent is dropped: 4 foods, 10 lines). All caused by ticket 76, one run each. 15 foods that had a parent in both m70 runs got an empty list now, but the share without a parent is unchanged (49 of 521, m70a 48 of 522): run variance, no ticket.
