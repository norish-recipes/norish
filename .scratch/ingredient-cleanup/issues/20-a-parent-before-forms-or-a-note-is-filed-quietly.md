# 20: A parent before forms or a note is filed quietly

**What to build:** Ticket 16's rule (Mike, 2026-10-20: "I think this is a good rule"). A new food's parent from the words is filed without a flag when the parent's spelling starts the name and only cuts, forms, sizes or a note follow it. Today only a parent whose spelling ends the name is filed quietly; every other parent from the words is an unsure AI Change that flags the food.

- **A note:** the note words join the words a name is read up to, the list "with", "in" and "met" are on today ("sardines in water" is filed under sardine). The words before a note are then the name, so the parent ends them, and is sure as today:
  - "greek yogurt for topping" under greek yogurt;
  - "olijven naar keuze" under olive;
  - "tonijn uit blik" under tuna.
  
  It also fixes a wrong parent: "olie om te bakken" is read as "olie", never as "te" (tea).
  - Measured note words: "for", "voor", "naar", "uit", "to", "om", "circa", "ca", "bijv", "bv", "op", "per".
  - The list's label in the Ingredient Words settings says what it now does: the words a name ends before.
- **Cuts and forms:** a new Ingredient Words list. A parent whose spelling starts the name, followed only by these words and the sizes, is sure:
  - "mango blokjes" under mango;
  - "chicken strips" under chicken;
  - "kipfilet blokjes" under chicken fillet.
  - Measured words: "bits", "blokjes", "blokken", "bolletjes", "boontjes", "broodjes", "chunks", "cube", "cubes", "curls", "filet", "filets", "fillet", "fillets", "fries", "friet", "gehakt", "hapjes", "loaf", "loins", "mince", "partjes", "pearls", "peulen", "pieces", "plakjes", "reepjes", "roosjes", "sheets", "slices", "spears", "stick", "sticks", "strips", "stukjes", "stukken", "vellen", "wedges", "zest".
  - Left out on purpose, because they go both ways: "flakes" (almond flakes, but chili flakes), "leaves" and "blaadjes" (curry leaves, salam leaves), "brokken".
- **Every language** gets its words in the defaults, as the joining words did.
- **`RUNG_VERSION` goes up**, so the startup recheck files the old mints again under the new rule.
- **Upgrade note:** edited Ingredient Words get none of the new words, as with the joining words.

**Blocked by:** None

**Status:** done

- [x] "mango blokjes", "greek yogurt for topping" and "tonijn uit blik" are minted under mango, greek yogurt and tuna, unflagged, with nothing on Changed by AI.
- [x] "onion powder", "chili flakes", "curry leaves" and "salam blaadjes" still flag their food when filed under onion, chili pepper, curry and salami.
- [x] "olie om te bakken" is never filed under tea.
- [x] The cuts-and-forms list and the longer note list are editable in the Ingredient Words settings, in every language.
- [x] Release notes and the upgrade note.
- [ ] All `CONTRIBUTING.md` gates pass.

## Comments

The word lists come from the same set they were measured on (ticket 16): 53 of 273 unsure parents filed quietly, none wrong. Expect a few misses on other catalogues.

2026-10-20, the note half measured both ways on ticket 16's set (Mike: "your proposal is also good"):

- Ticket 16's form (the parent starts the name, a note word follows) files 25 names quietly, all right. Reading up to a note word, as this ticket does, files all 25 the same, and more:
  - 6 more right ones: "active sourdough starter for the wraps", "flaky sea salt to finish", "gepofte zoete aardappel per persoon", "evt vers fruit voor het decoreren", "croissant deeg voor", "zalmfilets op de huid" (salmon fillet, no parent before);
  - about 15 names whose parent is sure and wrong today get the right one: "… for the coating" under coating, "yoghurt voor de saus" under sauce, "oil for frying" under frying, "full fat yogurt for the meat" under meat; and the three "te" lines are no longer filed under tea;
  - 2 new wrong ones, both "or" lines: "fresh greens like lettuce or arugula for extra crunch" under rocket, "beetje olie of boter om de cakevorm in te vetten" under butter. The joining words split the second before a mint when both parts are known; the first is minted and AI's pass looks at it.
- Ticket 16's form is in this ticket too: it is the cuts-and-forms half (28 of the 53).

2026-10-21, implemented:

- `servedWith` is now `endsBefore`, the label saying what it does; migration 0080 renames the key in an administrator's edited words, so they keep theirs. The new list is `forms`.
- "Unflagged" is read as ticket 16 used it: no unsure AI Change. A mint is still flagged as waiting on AI's pass (or `upgrade` with AI off), as "ground cumin" is.
- A parent the name starts with before its forms alone is sure at any length, as one the name ends with is: "kip grote reepjes" is under chicken although "kip" has three letters.
- The startup recheck also files again a guess whose words now read as sure under the same parent, which takes its unsure AI Change off. Without that, an old "mango blokjes" under mango would have kept its question.
- Every language has words in both lists except Korean's `endsBefore`, which stays empty: Korean writes "for" and "in" as particles on the word before, so no separate word starts a note. Beyond English and Dutch, the words are translations, not measured: "for", "to", "about", "per", "from" and the common cuts ("Würfel", "tiras", "кубики"). Words that go both ways were left out ("à", "da", "a": "pâte à tartiner" is no dough).
- The words of every language are read together, so the other languages' note and form words also cut English and Dutch names. On the dev database (the production copy), only two texts have one of those words past their first word: "do" in "avocado, chunky dice (watch video to see how i do this)" and "je" in "kalkoenlapjes (optioneel, kan ook zonder als je vegetarisch wilt eten)". In both the word sits after a comma or inside a bracket, which rung 2 strips first, so neither changes.
- Migration 0080 was run by hand on a scratch database: an edited row's `servedWith` moves to `endsBefore` per language, and other keys and empty words are left alone.
