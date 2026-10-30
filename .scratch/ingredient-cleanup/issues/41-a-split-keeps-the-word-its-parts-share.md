# 41: A split keeps the word its parts share

**What to build:** Found by the audit of ticket 31's final run (2026-10-22, `m31c_post_on`). 7 joined foods were split with a part on the wrong food (10 lines). Five of them lost the word both parts share:

- "chicken or vegetable stock" became chicken and vegetable broth;
- "vegetable or chicken broth" became vegetable and chicken broth;
- "cherry or grape tomatoes" became cherry and grape tomato;
- "zonnebloem- of kokosolie" became sunflower and coconut oil;
- "sap van citroen of limoen" became lemon juice and lime.

**The cause.** AI split none of the five: each has a 0.25 `parent_chosen`, so AI never read them (ticket 40). The first start's cleanup split them with AI off, in step 5 (`cleanUpCatalogue` → `partsByWordsOf` → `foodsByWords` in `packages/shared-server/src/ingredients/resolver.ts`). `joinedParts` cuts the name at the joining word, and each part is then read alone. A part that is one half of a shared head or tail ("cherry", "chicken", "vegetable", "zonnebloem-", "limoen") is a known food on its own, so the split is accepted. Recipe lines at import (`resolveLineFoods`) and typed groceries (`typedParts`) take the same path.

AI writes each part whole ("sticky or sushi rice" became sticky rice and sushi rice in the same run). The two other wrong splits are not this cause:

- "zaden en pitten": AI read seeds and kernels, and both are seed.
- "vegatine of agar agar" ended up on barley. The Decision answered that "agar agar" is none of the foods it was shown (0.98). The part was then resolved through the import resolver (`resolveParts` in `review.ts`), and its slip rung took barley's Basque spelling "garagar". That needs a ticket of its own if wanted.

**Fix (one rule, in `spelledParts` / `foodsByWords`):** where two parts differ in length, the shorter part is first read with the longer part's extra words. A shorter first part takes the longer part's last words ("cherry" becomes "cherry tomatoes", "chicken" becomes "chicken stock"). A shorter last part takes its first words ("thigh" in "chicken breast or thigh" becomes "chicken thigh"). That reading is the part wherever rungs 1–2 know it; else the part is read as written.

- A part ending in a hyphen borrows the same way at any length ("rode- en witte kool" gives "rode kool"). If the borrowed reading is unknown, the words refuse the split ("zonnebloem- of kokosolie" is left for AI).
- No `RUNG_VERSION` or `CLEANUP_VERSION` bump: only rc and dev instances ran the old split.
- A rough check over the copy's 214 lines that name several foods found no split this rule makes worse ("Snuf peper en zout" reads "snuf zout", which is still salt).
- It does not fix "sap van citroen of limoen": the catalogue has no spelling "sap van limoen", so lime stays.

**Blocked by:** None

**Status:** done

- [x] "cherry or grape tomatoes" names cherry tomato and grape tomato; "chicken or vegetable stock" names chicken broth and vegetable broth; "chicken breast or thigh" names chicken breast and chicken thigh. This holds at import and in the first start's split.
- [x] The words do not split "zonnebloem- of kokosolie".
- [x] "salt and black pepper" still names salt and black pepper.

## Implemented (2026-10-22)

- `sharedWordReadings` in `packages/shared-server/src/ingredients/resolver.ts`, called by `spelledParts`: `SpelledParts.spellings` became `readings: Spelling[][]`, each part's readings in order. A part fewer words than the last part (for the last part: the first) is first read with that part's extra last (first) words; a part before the last ending in "-" is read only that way, borrowing at least one word ("rode- en witte kool" is "rode kool"; "zonnebloem- of kokosolie" tries "zonnebloem kokosolie", unknown, so no split). `foodsByWords` takes each part's first reading rungs 1-2 know, and that reading is the part's text, so a typed Grocery split off "cherry or grape tomatoes" is named "cherry tomatoes". `readByWords` and `partsByWordsOf` fetch aliases for every reading. Import (`resolveLineFoods`), typed groceries/pantry (`typedParts`) and the first start's step 5 all go through it.
- With more than two parts every non-last part borrows from the last ("chicken, beef or vegetable stock" reads chicken stock and beef stock).
- No `RUNG_VERSION` or `CLEANUP_VERSION` bump, as the ticket says (stays 10 and 4): only rc/dev ran the old split, and re-running step 5 there would not undo a split already made, since the joined food is gone.
- Tests: `resolver.test.ts` "reads the shorter part with the words the parts share, where that reading is known" (the ticket's cases plus "rode- en witte kool"), `first-start-cleanup.test.ts` "splits a joined food keeping the word its parts share, and leaves one that reading misses".
- No docs or release-notes line became wrong ("every part is a known food" still holds).

## Review fixes (2026-10-22)

- **Measured** (read-only, on `m31c_post_on` and `norish_prod_pristine`, every recipe line text and own spelling the joining words split, with HEAD's borrowing): a borrow "fires" where rungs 1-2 know the borrowed reading.
  - `m31c_post_on`: 3,792 texts, 104 split, 208 parts, 28 borrows fire; 24 land on the food the part names as written, 4 on another food, all 4 right (corn starch twice, cherry tomato, vegetable broth); 0 wrong. The hyphen refusal of "zonnebloem- of kokosolie" is right.
  - `norish_prod_pristine`: 3,887 texts, 11 split, 3 borrows fire, all on the same food; 0 wrong.
  - Against the seeded catalogue alone (a fresh instance, or 0.25's joined foods at step 5): 296 split, 53 fire, 27 on another food; 1 wrong, "butter or coconut oil" as butterfat. Every "together" borrow that changed a food was a hyphen one.
  - Not in the data, but wrong today: "garlic and olive oil" (garlic oil) and "lemon and olive oil" (lemon oil), both seeded English spellings.
- **Rule taken:** only alternatives ("or" words) borrow, and a hyphened part at any join (`sharedWordReadings(parts, joined)`). It keeps every right borrow and every case above, with no wrong read on the real set. Rules that also refuse a borrow where the shorter part is a known spelling, or a seeded single word, lose cherry, vegetable and chicken, and break this ticket's cases.
- **Known miss:** "butter or coconut oil" still reads butterfat on a catalogue that knows only the seed; no lean rule separated it from cherry/vegetable/chicken.
- Tests: `resolver.test.ts` "borrows no words between foods joined together: garlic and olive oil is not garlic oil" (red first), beside the right borrow "cherry or grape tomatoes".
