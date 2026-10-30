# 04: A recipe line names several foods

**What to build:** A recipe line whose text joins foods points at each of them, either as foods needed **together** or as **alternatives**. The line keeps its text.

**The split rule** (words only):
- A name known whole by rungs 1–2 is never split ("mac and cheese", "half and half").
- Otherwise it splits at a joining word when every part matches by rungs 1–2. The joining words are a new kind of Ingredient Word: "and", "en", "und", "&" (together); "or", "oder", "ou", "of", "en/of", "and/or" (alternatives); plus each shipped language's words.
- "of" is accepted only when the parts are not all English spellings, read from the alias locale as a hint: "juice of a lemon" stays one, "boter of olie" and "water of kokosmelk" split.

**What reads it:**
- **Pantry:** an alternatives line is covered when any of its foods is kept. A together line is checked food by food.
- **Add to groceries:** the panel shows one row per food it will add. Each food of a together line comes with the line's full amount. An alternatives line adds only its first food.
- **Nutrition:** an alternatives line counts its first food; a together line counts each food at the full amount.
- **Icon:** the line shows its first food's icon.
- **Uses:** the "where used" panel and in-use counts list the line under every food it names.

See `CONTEXT.md` (Ingredient Alias, Ingredient Words, Pantry Ingredient, Ingredient Icon) and ADR-0037's third 2026-10-17 amendment.

**Blocked by:** 03

**Status:** done

- [x] "zout en peper", "boter of olie", "water of kokosmelk" and "parmezaanse kaas en/of pijnboompitten" (with both parts known) resolve to two foods with the right join.
- [x] "mac and cheese" (known whole), "juice of a lemon" (all English), "handful of arugula" (one part not a food) and "Arla Skyr Peach & Passionfruit" (a part not known) stay one food.
- [x] The joining words ship in every language's Ingredient Words, and an administrator's edited set is honoured.
- [x] Pantry: "boter of olie" is in the pantry when only olie is kept. With "zout en peper" and only zout kept, peper goes on the list and zout shows as stocked.
- [x] Add to groceries: "2 el boter en suiker" adds 2 el boter and 2 el suiker; "boter of olie" adds boter.
- [x] Nutrition counts "100 g boter of olie" as 100 g boter, and "100 g ham en kaas" as 100 g of each.
- [x] The line shows the first food's icon; both foods' "where used" panels list the line.
- [x] Browser: a recipe with "zout en peper" added to the groceries puts "zout" and "peper" on the list as two groceries (catalogue spec, `ai` project).
- [x] All `CONTRIBUTING.md` gates pass.

## Comments

2026-10-18, implemented:

- The joining words are two new kinds of Ingredient Words, `together` and `alternatives`, shipped for all 15 languages; `joinedParts` (spelling-keys) splits a name at them, never inside brackets, and not where "and" and "or" are mixed. The admin settings page lists them.
- `resolveLineFoods` reads a recipe line not known whole by its words before AI is asked. Parts that are one food name it alone ("spring onions or scallions"). Groceries and the Pantry still resolve one food (ticket 05).
- The "of" rule is data: a joining word that is some language's connector (only English "of" today) never splits a name whose every part is spelled in that language. A household's own spellings carry no language, so they split (Mike, 2026-10-18). On the production copy that reads 19 of 20 "X of Y" lines right; the miss is "(14oz) tin of full-fat coconut milk", where "Tin" matches ice through a Navajo seed spelling. Requiring both parts to share a language would split only 2 of the 19 Dutch lines: a seeded spelling several languages share stores one ("honing" li, "Olie" da, "rucola" en).
- `getRecipeFull` sends `joined` and each food with its spelling (`foods`) for a line naming several; `ingredientId` stays the first, so icons need nothing. `foodsToBuy` (shared) expands lines for the add-to-groceries panel and nutrition, whose split rows are named by the food's spelling; the nutrition estimator reads amounts from the same expansion.
- The Pantry's suggestions and the icon round's use counts count every food of a line; the spoon measure reads lines as nutrition does.
- An administrator's edited Ingredient Words keep no joining words after the upgrade (an edited set no longer follows a release); the upgrade note is ticket 09's.
