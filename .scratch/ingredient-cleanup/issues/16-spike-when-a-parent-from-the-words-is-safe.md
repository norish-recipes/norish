# 16 (spike): When is a parent from the words safe?

**Question:** A new food that the words of its name file under a known food ("verse peterselie" under peterselie, "garlic cloves crushed" under garlic) is an unsure entry on Changed by AI. It flags the food, unless the known food's spelling ends the name. Mike, 2026-10-20: "I think we can make some algorithm and when to say this is save to not flag". Find a rule saying when a parent from the words is safe enough to file without a flag.

**How:**

- Run the words' parent over every line and own food on the production copy (Mike's real set, not the Italian slice).
- Mark each parent right or wrong by hand.
- Test candidate signals:
  - the parent's spelling ends the name (today's rule);
  - the other words are only preparation, size or colour words from the Ingredient Words ("verse", "gehakte", "large");
  - the parent is a seeded food with no children yet;
  - the name and the parent's spelling are in the same language.
- Write down:
  - the rule;
  - how many flags it removes;
  - every wrong parent it would file without a flag.

Only a measuring script, no product code. The result is a ticket for the rule, or a note that today's rule stays.

**Blocked by:** None

**Status:** done (for Mike to decide)

- [x] The real set's words-parents are listed with right or wrong (outside the repo, see Comments).
- [x] The proposed rule, its flags removed and its misses are written down, for Mike to decide.

## Comments

2026-10-20, measured:

- **Set:** a clone of `norish_prod_pristine` (production, 2026-10-17), with this release's default Ingredient Words (production's were the unedited 0.25 defaults). 3,954 texts: 3,247 distinct recipe-line texts and 707 own food names. `parentFromWordsOf` on each, read-only.
- **What the words file:** 2,665 texts get a parent; 2,226 sure (the parent's spelling ends the name) and 439 unsure (273 distinct names). Every unsure one flags its food today.
- **Hand-marked:** of the 273 distinct unsure parents, 163 are right and 110 wrong. The full list with right or wrong is in `~/Documents/norish-spike-16/judged.json`, not here: it is production text (ticket 12's rule). The wrong ones fall into three groups:
  - 26 name several foods ("maple syrup or honey" under maple syrup, "fresh dill and parsley" under dill);
  - about 50 are a product named after a food ("onion powder" under onion, "chili flakes" under chili pepper, "tomato paste", "strawberry frosting", "mango chutney", "tortilla chips");
  - about 34 hit another food's short or foreign spelling, or a note ("te" is tea in "olie om te bakken", "garam" is salt, "raw" is apples, "salam" is salami, "lay" is garlic).
  So today's flag earns its keep: 40% of unsure words-parents are wrong.
- **The ticket's signals:** "only preparation or size words" removes 0 flags, as do colours: the words around a parent are cuts and notes ("blokjes", "for brushing"), never preparation words. "Seeded with no children" removes 12, 2 of them wrong ("nora brokken" under spicy red pepper). "Same language" removes 2; seed locales are too weak to say more ([[norish-seed-spelling-locale-weak]]).

**Proposed rule:** an unsure words-parent is filed without a flag when the parent's spelling starts the name and what follows is only:

- form and size words: a new Ingredient Words list for cuts and forms ("bits", "blokjes", "blokken", "bolletjes", "boontjes", "broodjes", "chunks", "cube", "cubes", "curls", "filet", "filets", "fillet", "fillets", "fries", "friet", "gehakt", "hapjes", "loaf", "loins", "mince", "partjes", "pearls", "peulen", "pieces", "plakjes", "reepjes", "roosjes", "sheets", "slices", "spears", "stick", "sticks", "strips", "stukjes", "stukken", "vellen", "wedges", "zest"), with the sizes ("groot", "grote", "jumbo", "klein", "kleine", "large", "medium", "mini", "small"); or
- a note opened by a note word ("bijv", "bv", "ca", "circa", "for", "naar", "om", "op", "per", "to", "uit", "voor"): "greek yogurt for topping", "olijven naar keuze", "tonijn uit blik", "peterselie voor de garnering".

These lists are exactly what `spike-16/rule.py` measured.

**Flags removed:** 53 of the 273 distinct names (74 of 439 texts), 20 of them own foods that flagged on production. **Wrong parents it files without a flag: none** on this set.

**Caveats for Mike:**

- The form list was drawn from this same set, so zero misses is a best case. Left out on purpose because they go both ways: "flakes" (almond flakes right, chili flakes wrong), "leaves"/"blaadjes" (curry leaves and salam leaves wrong), "brokken" ("nora brokken").
- It is a new Ingredient Words list, so every language needs its words, and an administrator who edited the words gets none (as with the joining words).
- 20 flags is small beside what the pass now settles by itself: every unsure words-parent is asked about by AI moments after its mint anyway (ticket 07). The rule matters most with AI off.

Lean recommendation: keep today's rule unless the flags bother Mike with AI off; the pass already re-asks these with AI on. If he wants it, the rule above is ticket-ready.

The script is `spike-16/words-parents.ts` (copy into `packages/shared-server` to run), and `spike-16/rule.py` applies the rule to its output.


2026-10-20, Mike: "I think this is a good rule". It is ticket 20, with the note words added to the words a name is read up to (the "with", "in", "met" list), which files the same names and also stops "olie om te bakken" reaching "te".

On the 26 wrong parents that name several foods: the spike read every text, but an import never gets that far for half of them. Leaving the joined food itself out, as the first-start cleanup does, the joining words split 13 of the 26 before anything is minted ("maple syrup or honey", "Verse basilicum of rucola", "Parmezaanse kaas or Pecorino"). The other 13 have a part the catalogue does not know whole ("kipfilet of kiphaasjes", "toasted pine nuts or cashews"), so they are minted whole, with the flag, and AI's pass splits them when it is sure. Two of the 13 word splits look wrong: "Corn Flour or Starch" gives "Starch" alone, and "vanilla extract or paste" gives "paste" alone.
