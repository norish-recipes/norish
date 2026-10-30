# 52: A seeded spelling that names another food decides AI's answer

**What to build:** Found by ticket 31's run after tickets 32-48 (2026-10-22, HEAD fa3fb4295, `m48_post_on`). Two seed spellings name a different food than the one they sit on, and AI's right reading lands on them:

- "chicken drumstick" (en) is a seeded spelling of chicken thigh. AI read an own drumstick food as "chicken drumsticks", other name "chicken drumstick", and the pass merged it, sure, into chicken thigh. A joined "thighs and/or drumsticks" food now names chicken thigh only. On the copy: 1 sure merge, about 4 drumstick lines now on chicken thigh.
- "steak" (fr) is a seeded spelling of patty. AI's parent "steak" filed a steak food, sure, under patty (it was under beef steak), and keeps another steak food there (flagged unsure). On the copy: 2 foods.

Ticket 21's seed corrections (`SPELLING_MOVES`) can move both; whether to is Mike's call (ticket 39 was a near-neighbour product and closed as wontfix).

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-23)

"build all except 66". Seed corrections fix both: French "steak" moves from patty to beef steak; English "chicken drumstick" leaves chicken thigh (no seeded drumstick food exists, so AI makes its own drumstick food). Same mechanism as en:yam → en:jam, SEED_CORRECTIONS_VERSION bumped.

## Implemented (2026-10-23)

- `SPELLING_MOVES` (`seed/catalogue-seed.ts`) gains `en:patty` → `en:beef-steak` ("steak") and `en:chicken-thigh` → `null` ("chicken drumstick"). `to: null` is the one new thing: the file gives the spelling to no entry. `SEED_CORRECTIONS_VERSION` 4.
- On an instance seeded before, `correctSeedOnce` takes a null move's spelling off through `takeOffSeededSpelling(fold, fromId)` (`db/repositories/ingredient-seed.ts`, shares `lockSpellingOn` with `moveSeededSpelling`), which answers the rows that named it; they are read again with `resolveAgain(rows, "person")`, as AI's spelling removal does, so a drumstick line mints its own food for AI's pass. A null move refiles no children. It counts in `moved`.
- Tests (`catalogue-seed.test.ts`): "gives steak to beef steak, and takes chicken drumstick off chicken thigh, when the file is applied" and "takes chicken drumstick off chicken thigh once on an instance seeded before, its lines read again". Release-notes line after the jam line. Checked against the live OFF file: "steak" is French on patty only, "chicken drumstick" English on chicken thigh only.
