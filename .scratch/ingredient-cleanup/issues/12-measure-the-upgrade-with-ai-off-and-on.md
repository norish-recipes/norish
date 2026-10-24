# 12: Measure the upgrade on the production copy, with AI off and on

**What to build:** A before-and-after report of what this release does to a real catalogue. Start from the production copy as it stands on 0.25.1, run it on 0.25.1 and on this release, each once with AI off and once with AI on, and compare the four.

- **Start:** a clone of `norish_prod_pristine` (production, 2026-10-17). If its migrations are not exactly v0.25.1's, boot v0.25.1 on the clone first. The template itself is never booted.
- **Pre, AI off:** a fresh clone of the start, booted on v0.25.1 with AI off.
- **Pre, AI on:** a fresh clone of the start, booted on v0.25.1 with AI on (the dev AI config re-inserted). 0.25.1's AI acts only when asked, so an admin runs Fix catalogue over all three parts. Its suggestions are counted, then Confirm all applies them, and the catalogue is measured after.
- **After, AI off:** a fresh clone of the start, booted on this release with AI off. Measured once the first start's cleanup has finished.
- **After, AI on:** a fresh clone of the start, booted on this release with AI on (the dev AI config re-inserted). Measured once the cleanup and the AI pass over every undecided food have finished.
- **One read-only script** reads the same counts from all four databases.

**What is counted:**

- Ingredients: own and seeded; flagged, by reason; kept distinct; with a parent.
- Spellings: all, and own.
- Recipe lines: naming one food, several (together or alternatives), or none; Headings. No line is deleted (2026-10-20).
- Groceries, recurring groceries and Pantry Ingredients that point at no food.
- Joined names still a food of their own.
- Pre, AI on: the Fix catalogue round's suggestions by kind, and what Confirm all did with them.
- After, AI on: AI Changes by kind, sure and unsure.
- Both AI-on runs: the requests and tokens the AI round or pass used, from the job monitor.
- Every run: how long the start took; for this release, the first start's cleanup and the AI pass apart.
- The spec's named cases, in all four databases: their lines, foods and spellings. These are "gyoza vellen", "3wu)", "paprika (vrucht)", "zout en peper", "boter of olie", "water of kokosmelk", "juice of a lemon", "mac and cheese", "toilet paper", "deegroller", "melted", "Voor de salade:" and "taart- of springvorm".

Recipe text from production stays out of the repo: only counts and the named cases go in this ticket. Any per-line listing for Mike to read is kept outside the repository.

**Blocked by:** 08, 09

**Status:** done

- [x] All four runs are measured with the same script. A table of the counts (0.25.1 AI off / 0.25.1 AI on / this release AI off / this release AI on) is in this ticket's Comments.
- [x] Each named case is listed for all four databases.
- [x] The 0.25.1 round's suggestions are counted by kind, and this release's AI Changes by kind and sureness, each with the requests and tokens it used.
- [x] Nothing writes to the template: every run is on its own clone.
- [x] Every result that looks wrong becomes a ticket of its own, not a fix here.

## Comments

2026-10-21, measured (Mike: pre and after, each with and without AI, every case either way):

- **How:** four clones of `norish_prod_pristine` in `norish-db-local` (`m12_pre_off`, `m12_pre_on`, `m12_post_off`, `m12_post_on`), each with its own Redis. The template's migrations are exactly v0.25.1's (plus the three old harmless ones), so no extra boot was needed. 0.25.1 ran from a worktree at `v0.25.1-beta` (Node 22), this release from one at 9e968d049, both without a file watcher. The script is `../measure-12/measure.mjs`; the named cases' line texts per run are in `~/Documents/norish-ticket-12/` (outside the repo).
- **AI config:** the dev config in `.runtime/prod-copy/ai-config.sql` does not decrypt with the production MASTER_KEY now in `.env.local`, so both AI-on runs used the copy's own production config (OpenAI gpt-6-luna, Jev; automatic Plain Name and icons on, as in production). AI off = `enabled: false` with the encrypted copy cleared: this release's boot rewrites the shown config from the encrypted one, so flipping only the shown flag left AI on (a first attempt sent 49 requests and was thrown away).
- **0.25.1 AI on:** Fix catalogue over all three parts asked about 54 foods (4 flagged, 50 Plain Names) in 16 s. The script, run before Confirm all, counted 2 suggestions (rename); after it, none are left, so the table has no suggestions row. Outcomes per food, from the round's job progress: the 4 flagged foods stayed unsure, 46 Plain Names came back unsure ("no-food", no rename), 2 already plain, 2 renames. The 2 rename suggestions were confirmed (Confirm all: 2 done). Nothing else changes, so its catalogue equals AI off but for 2 names.
- **Both boots** also ran the nightly catalogue refresh (11 new seeded foods, 352 seeded spellings from today's Open Food Facts); the startup maintenance removes done groceries. Both versions do this alike. On this release, groceries 71 to 72 and recurring groceries 8 to 11 are joined names split per food (ticket 05).
- **This release, AI off:** the one AI Change is an unsure words-parent the recheck filed (`fromWords`, flagged `ai-unsure`; ticket 28). The `upgrade` flag is a joined food the cleanup's re-resolve minted: its second part is no known food, so the words keep it whole.
- **Time:** 0.25.1 ready in 8.8 s (AI off, the first boot) and 5.4 s (AI on). This release ready in 5.8 s (AI off) and 6.5 s (AI on), of which recheck plus cleanup took 2.1 s: cleaned 86 spellings, removed 421, split 59 joined foods, renamed 6, seeded-spelling fixes 3, and queued 70 foods for AI. The AI pass took 36 s, 53 s with the 3 follow-up passes over foods the first one minted; 2 icon rounds drew 4 icons in 41 s more. The `ponytail:` estimate in ticket 09 (~2.5 min for ~71k spellings) does not apply: the copy holds 1,904 own spellings, not 71k.

**Ingredients**

|               | 0.25.1 AI off | 0.25.1 AI on | 0.26 AI off | 0.26 AI on |
| ------------- | ------------: | -----------: | ----------: | ---------: |
| all           |          6437 |         6437 |        6379 |       6351 |
| own           |           707 |          707 |         649 |        621 |
| seeded        |          5730 |         5730 |        5730 |       5730 |
| flagged       |             4 |            4 |           3 |          9 |
| keptDistinct  |           129 |          129 |         114 |        114 |
| withParent    |          6012 |         6012 |        5958 |       5941 |
| ownWithParent |           586 |          586 |         532 |        515 |

**Flagged, by reason**

|           | 0.25.1 AI off | 0.25.1 AI on | 0.26 AI off | 0.26 AI on |
| --------- | ------------: | -----------: | ----------: | ---------: |
| ai-unsure |             4 |            4 |           2 |          9 |
| upgrade   |             – |            – |           1 |          – |

**Spellings**

|     | 0.25.1 AI off | 0.25.1 AI on | 0.26 AI off | 0.26 AI on |
| --- | ------------: | -----------: | ----------: | ---------: |
| all |         71960 |        71962 |       71443 |      71438 |
| own |          1904 |         1906 |        1387 |       1382 |

**Recipe lines**

|                         | 0.25.1 AI off | 0.25.1 AI on | 0.26 AI off | 0.26 AI on |
| ----------------------- | ------------: | -----------: | ----------: | ---------: |
| colon line, with a food |            11 |           11 |          11 |         11 |
| heading                 |           164 |          164 |         164 |        164 |
| no food                 |            19 |           19 |          19 |         21 |
| one food                |          6033 |         6033 |        5835 |       5828 |
| several, alternatives   |             – |            – |          58 |         63 |
| several, together       |             – |            – |         140 |        140 |

**Rows that point at no food**

|                    | 0.25.1 AI off | 0.25.1 AI on | 0.26 AI off | 0.26 AI on |
| ------------------ | ------------: | -----------: | ----------: | ---------: |
| groceries          |             0 |            0 |           0 |          1 |
| recurringGroceries |             0 |            0 |           0 |          0 |
| pantryIngredients  |             0 |            0 |           0 |          0 |

**Rows**

|                    | 0.25.1 AI off | 0.25.1 AI on | 0.26 AI off | 0.26 AI on |
| ------------------ | ------------: | -----------: | ----------: | ---------: |
| lines              |          6227 |         6227 |        6227 |       6227 |
| groceries          |            71 |           71 |          72 |         72 |
| recurringGroceries |             8 |            8 |          11 |         11 |
| pantryIngredients  |             7 |            7 |           7 |          7 |

**Joined names still a food of their own**

|           | 0.25.1 AI off | 0.25.1 AI on | 0.26 AI off | 0.26 AI on |
| --------- | ------------: | -----------: | ----------: | ---------: |
| own foods |            92 |           92 |          34 |         32 |

**AI Changes**

|                  | 0.25.1 AI off | 0.25.1 AI on | 0.26 AI off | 0.26 AI on |
| ---------------- | ------------: | -----------: | ----------: | ---------: |
| parent, unsure   |             – |            – |           1 |          – |
| merge, sure      |             – |            – |           – |         20 |
| merge, unsure    |             – |            – |           – |          5 |
| not-a-food, sure |             – |            – |           – |          3 |
| parent, sure     |             – |            – |           – |         19 |

**AI use, ingredient-review queue**

|                       | 0.25.1 AI off | 0.25.1 AI on | 0.26 AI off | 0.26 AI on |
| --------------------- | ------------: | -----------: | ----------: | ---------: |
| jobs                  |             – |            1 |           – |          4 |
| requests              |             – |           62 |           – |         87 |
| failed                |             – |            0 |           – |          0 |
| tokens                |             – |        41076 |           – |      98768 |
| openai · gpt-6-luna   |             – |           58 |           – |         80 |
| typesafe · jev-1.13.0 |             – |            4 |           – |          7 |

**AI use, ingredient-icons queue**

|                           | 0.25.1 AI off | 0.25.1 AI on | 0.26 AI off | 0.26 AI on |
| ------------------------- | ------------: | -----------: | ----------: | ---------: |
| jobs                      |             – |            – |           – |          2 |
| requests                  |             – |            – |           – |          4 |
| failed                    |             – |            – |           – |          0 |
| tokens                    |             – |            – |           – |          0 |
| openai · gpt-image-1-mini |             – |            – |           – |          4 |

**Named cases**

- **"gyoza vellen"**
  - 0.25.1 AI off: spellings gyoza vellen ((ontdooid)) → gyoza vellen, gyoza vellen ) → gyoza vellen. Foods gyoza vellen [distinct]. Lines 2: 2× gyoza vellen.
  - 0.25.1 AI on: spellings gyoza vellen ((ontdooid)) → gyoza vellen, gyoza vellen ) → gyoza vellen. Foods gyoza vellen [distinct]. Lines 2: 2× gyoza vellen.
  - 0.26 AI off: spellings gyoza vellen → gyoza vellen. Foods gyoza vellen [distinct]. Lines 2: 2× gyoza vellen.
  - 0.26 AI on: spellings gyoza vellen → gyoza vellen. Foods gyoza vellen [distinct]. Lines 2: 2× gyoza vellen.
- **"3wu)"**
  - 0.25.1 AI off: spellings 3wu) [seed] → honey. Foods honey [seed] under added sugar. Lines 0.
  - 0.25.1 AI on: spellings 3wu) [seed] → honey. Foods honey [seed] under added sugar. Lines 0.
  - 0.26 AI off: spellings none. Foods none. Lines 0.
  - 0.26 AI on: spellings none. Foods none. Lines 0.
- **"paprika (vrucht)"**
  - 0.25.1 AI off: spellings paprika (vrucht) [seed] → bell pepper. Foods bell pepper [seed] under capsicum annuum. Lines 0.
  - 0.25.1 AI on: spellings paprika (vrucht) [seed] → bell pepper. Foods bell pepper [seed] under capsicum annuum. Lines 0.
  - 0.26 AI off: spellings paprika (vrucht) [seed] → bell pepper. Foods bell pepper [seed] under capsicum annuum. Lines 0.
  - 0.26 AI on: spellings paprika (vrucht) [seed] → bell pepper. Foods bell pepper [seed] under capsicum annuum. Lines 0.
- **"zout en peper"**
  - 0.25.1 AI off: spellings Snuf zout en peper → zout en peper, flinke snuf zout en peper → zout en peper, zout en peper → zout en peper. Foods zout en peper under salt. Lines 43: 43× zout en peper.
  - 0.25.1 AI on: spellings Snuf zout en peper → zout en peper, flinke snuf zout en peper → zout en peper, zout en peper → zout en peper. Foods zout en peper under salt. Lines 43: 43× zout en peper.
  - 0.26 AI off: spellings peper [seed] → pepper, zout [seed] → salt. Foods pepper [seed] under seed, salt [seed]. Lines 43: 43× salt + pepper (together).
  - 0.26 AI on: spellings peper [seed] → pepper, zout [seed] → salt. Foods pepper [seed] under seed, salt [seed]. Lines 43: 43× salt + pepper (together).
- **"boter of olie"**
  - 0.25.1 AI off: spellings (1 el) boter of olie → boter of olie, boter of olie → boter of olie. Foods boter of olie under oil and fat. Lines 1: 1× boter of olie.
  - 0.25.1 AI on: spellings (1 el) boter of olie → boter of olie, boter of olie → boter of olie. Foods boter of olie under oil and fat. Lines 1: 1× boter of olie.
  - 0.26 AI off: spellings Olie [seed] → oil, boter [seed] → butter. Foods butter [seed] under dairy, oil [seed] under oil and fat. Lines 1: 1× butter + oil (alternatives).
  - 0.26 AI on: spellings Olie [seed] → oil, boter [seed] → butter. Foods butter [seed] under dairy, oil [seed] under oil and fat. Lines 1: 1× butter + oil (alternatives).
- **"water of kokosmelk"**
  - 0.25.1 AI off: spellings water of kokosmelk → water of kokosmelk. Foods water of kokosmelk [distinct] under coconut milk. Lines 2: 2× water of kokosmelk.
  - 0.25.1 AI on: spellings water of kokosmelk → water of kokosmelk. Foods water of kokosmelk [distinct] under coconut milk. Lines 2: 2× water of kokosmelk.
  - 0.26 AI off: spellings kokosmelk [seed] → coconut milk, water [seed] → water. Foods coconut milk [seed] under coconut, water [seed]. Lines 2: 2× water + coconut milk (alternatives).
  - 0.26 AI on: spellings kokosmelk [seed] → coconut milk, water [seed] → water. Foods coconut milk [seed] under coconut, water [seed] [flag: ai-unsure]. Lines 2: 2× water + coconut milk (alternatives).
- **"juice of a lemon"**
  - 0.25.1 AI off: spellings Juice of lemon → lemon juice, Juice of lime → lime juice, Juice of ½ lime → lime juice, juice of 1/2 a lemon → lemon juice, juice of one lime → lime juice. Foods lemon juice [seed] under fruit juice, lime juice [seed] under fruit juice. Lines 12: 9× lime juice; 3× lemon juice.
  - 0.25.1 AI on: spellings Juice of lemon → lemon juice, Juice of lime → lime juice, Juice of ½ lime → lime juice, juice of 1/2 a lemon → lemon juice, juice of one lime → lime juice. Foods lemon juice [seed] under fruit juice, lime juice [seed] under fruit juice. Lines 12: 9× lime juice; 3× lemon juice.
  - 0.26 AI off: spellings Juice of lemon → lemon juice, Juice of lime → lime juice, Juice of ½ lime → lime juice, juice of 1/2 a lemon → lemon juice, juice of one lime → lime juice. Foods lemon juice [seed] under fruit juice, lime juice [seed] under fruit juice. Lines 12: 9× lime juice; 3× lemon juice.
  - 0.26 AI on: spellings Juice of lemon → lemon juice, Juice of lime → lime juice, Juice of ½ lime → lime juice, juice of 1/2 a lemon → lemon juice, juice of one lime → lime juice. Foods lemon juice [seed] under fruit juice, lime juice [seed] under fruit juice. Lines 12: 9× lime juice; 3× lemon juice.
- **"mac and cheese"**
  - 0.25.1 AI off: spellings none. Foods none. Lines 0.
  - 0.25.1 AI on: spellings none. Foods none. Lines 0.
  - 0.26 AI off: spellings none. Foods none. Lines 0.
  - 0.26 AI on: spellings none. Foods none. Lines 0.
- **"toilet paper"**
  - 0.25.1 AI off: spellings Toiletpapier → Toiletpapier. Foods Toiletpapier [distinct]. Lines 0.
  - 0.25.1 AI on: spellings Toiletpapier → Toiletpapier. Foods Toiletpapier [distinct]. Lines 0.
  - 0.26 AI off: spellings Toiletpapier → Toiletpapier. Foods Toiletpapier [distinct]. Lines 0.
  - 0.26 AI on: spellings Toiletpapier → Toiletpapier. Foods Toiletpapier [distinct]. Lines 0.
- **"deegroller"**
  - 0.25.1 AI off: spellings deegroller → deegroller. Foods deegroller [distinct]. Lines 1: 1× deegroller.
  - 0.25.1 AI on: spellings deegroller → deegroller. Foods deegroller [distinct]. Lines 1: 1× deegroller.
  - 0.26 AI off: spellings deegroller → deegroller. Foods deegroller [distinct]. Lines 1: 1× deegroller.
  - 0.26 AI on: spellings deegroller → deegroller. Foods deegroller [distinct]. Lines 1: 1× deegroller.
- **"melted"**
  - 0.25.1 AI off: spellings butter [seed] → butter, melted → melted, unsalted butter [seed] → unsalted butter. Foods butter [seed] under dairy, melted [distinct], unsalted butter [seed] under butter. Lines 10: 1× melted; 3× unsalted butter; 6× butter.
  - 0.25.1 AI on: spellings butter [seed] → butter, melted → melted, unsalted butter [seed] → unsalted butter. Foods butter [seed] under dairy, melted [distinct], unsalted butter [seed] under butter. Lines 10: 1× melted; 3× unsalted butter; 6× butter.
  - 0.26 AI off: spellings butter [seed] → butter, melted → melted, unsalted butter [seed] → unsalted butter. Foods butter [seed] under dairy, melted [distinct], unsalted butter [seed] under butter. Lines 10: 1× melted; 3× unsalted butter; 6× butter.
  - 0.26 AI on: spellings butter [seed] → butter, melted → melted, unsalted butter [seed] → unsalted butter. Foods butter [seed] under dairy, melted [distinct], unsalted butter [seed] under butter. Lines 10: 1× melted; 3× unsalted butter; 6× butter.
- **"Voor de salade:"**
  - 0.25.1 AI off: spellings Voor de salade: → lettuce. Foods lettuce [seed] under leaf vegetable. Lines 3: 2× (no food); 1× lettuce.
  - 0.25.1 AI on: spellings Voor de salade: → lettuce. Foods lettuce [seed] under leaf vegetable. Lines 3: 2× (no food); 1× lettuce.
  - 0.26 AI off: spellings Voor de salade → lettuce. Foods lettuce [seed] under leaf vegetable. Lines 3: 2× (no food); 1× lettuce.
  - 0.26 AI on: spellings Voor de salade → lettuce. Foods lettuce [seed] under leaf vegetable. Lines 3: 2× (no food); 1× lettuce.
- **"taart- of springvorm"**
  - 0.25.1 AI off: spellings taart- of springvorm → taart- of springvorm, taart- of springvorm (doorsnede 26 cm), → taart- of springvorm. Foods taart- of springvorm under cake. Lines 1: 1× taart- of springvorm.
  - 0.25.1 AI on: spellings taart- of springvorm → taart- of springvorm, taart- of springvorm (doorsnede 26 cm), → taart- of springvorm. Foods taart- of springvorm under cake. Lines 1: 1× taart- of springvorm.
  - 0.26 AI off: spellings taart- of springvorm → taart- of springvorm. Foods taart- of springvorm under cake. Lines 1: 1× taart- of springvorm.
  - 0.26 AI on: spellings taart- of springvorm → taart- of springvorm. Foods taart- of springvorm under cake. Lines 1: 1× taart- of springvorm.

Results that look wrong, each a ticket (renumbered 2026-10-21 in the order they are worked on): 24 (AI's answer has no place for two foods side by side, so "salt cinnamon" and "koud water melk" were deleted), 25 (a grocery's food deleted as not a food: foods no recipe line names are hidden), 26 (two unsure merges into unrelated foods), 27 (3 of 4 dropped parents were wrong), 28 (a first word that is a seeded pepper spelling files a grocery's food under it), 29 (a joined food holding one part's spelling is never split), 30 (the 11 colon lines keep their food), and 31 measures them again. Foods kept distinct before this release are never asked: Mike keeps the marks, and ticket 31's clone clears them. Not tickets: the 32 joined own foods left after the AI pass are mostly "or" names whose parts are not each foods, and "taart- of springvorm" has a parent a person chose, so AI leaves it.
