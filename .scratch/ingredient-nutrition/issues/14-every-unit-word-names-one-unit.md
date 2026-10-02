# 14: Every unit word names one unit

**What to build:** Every word in the default units map names exactly one unit, chosen in the file. Today 68 folded words are claimed by two or more entries. A server reads the map from a jsonb column, which orders keys shortest first, and `normalizeUnit` takes the first entry that claims a word, so the shortest key wins:
- "T" is stored as a teaspoon, so "1 T olive oil" counts a third of the oil;
- "Stück" and "stuk" become a chunk, which nothing counts;
- "scheutje" becomes a dash, which counts as nothing;
- "dozen" becomes a box.

The work:
- Give each shared word one owner.
- Match "T" and "t" with their case wherever a unit word is read.
- Teach the map the British "heaped" spoons.
- Count a line stored as `chunk` through the piece weight, which also repairs the "stuk" lines parsed before this fix.

**Blocked by:** None (can start immediately)

**Status:** done, pending gates and review

- [x] A test over `packages/config/src/units.default.json` fails when two entries claim the same folded word, whether as id, short form, plural or alternate.
- [x] Each of the 68 shared words has one owner. The owners that change a count:
  - stuk, stuks, Stück, Stücke, pezzo and pezzi → piece;
  - scheutje and scheutjes → splash;
  - dozen → dozen.

  Review picks the rest.
- [x] "1 T olive oil" stores and counts as a tablespoon and "1 t salt" as a teaspoon, through import, paste import, manual entry and groceries (`normalizeUnit` and `resolveUnit`).
- [x] "2 heaped tsp cumin seeds" and "4 heaped tbsp Greek-style yogurt" store as teaspoons and tablespoons.
- [x] A line stored as `chunk` counts through the piece weight, like clove and slice.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, from the spoon-measures grill:
  - An administrator's overridden map is not rewritten, so its shared words keep resolving by key order; the test guards the default file.
  - Lines already stored keep their unit. An old "T" line can't be told from a real teaspoon and stays one.
  - The dev database's "2 heaped tsp cumin seeds" was stored with no unit and read as two pieces.
- 2026-10-02, implemented. One fold reads every unit word, `foldUnitWord` in `@norish/shared/lib/unit-localization`: trimmed, no trailing dot, lower case except "T" and "t". `normalizeUnit` and `resolveUnit` both use it, so the test guards exactly what they compare. 67 words were shared once "T" and "t" kept their case.
  - The owner is the unit that uses the word as its own name where only one does: Beutel and zakje are pouches, bolletje a scoop, repen a bar, stengel and Stängel stalks, 컵 a cup, 공기 a bowl, 장 a sheet, 토막 a fillet, 줄기 a sprig.
  - Where two units both used it as their name, a judgement call for review:
    - Blatt, feuille → leaf (sheet becomes Platte, plaque);
    - bol, bollen → ball, as servers read it today (bulb becomes knol in Dutch and knold in Danish; bowl becomes cuenco in Spanish and bolée, a bowlful, in French);
    - Kugel, kugle, pallina → ball (scoop becomes Kelle, øse, mestolo: the entry's other languages already say ladle);
    - glas, Gläser → glass, so a Dutch "glas melk" is no longer a jar (jar becomes Gl. in German, after Fl. and Pck., and krukke in Danish);
    - hoved → head (bulb as above);
    - pot, potten → pot (jar becomes potje in Dutch);
    - Scheibe, skive → slice (round becomes Rädchen and rund skive);
    - spicchio → clove (wedge becomes fettina in Italian, 웨지 in Korean);
    - Spritzer → dash (drizzle becomes Spritzerchen);
    - pose → bag (pouch becomes brev in Danish);
    - Packung, confezione → pack (sleeve becomes Tube, tubo);
    - 약간 → dash, 조금 → splash, 소량 → small splash, 통 → head, 병 → bottle, 봉지 → bag, 쪽 → clove, 개 → piece (ear becomes 이삭, jar 유리병, sleeve 묶음, tub 용기, bulb 뿌리);
    - a piacere → to taste, barattolo → jar, btl → bag (German "Btl." is Beutel).
  - Chunk's own names became tocco, brok and Brocken; it keeps "stukken" as a spelling. Box's Dutch name became doosje, keeping "doos".
  - "heaped tsp/teaspoon(s)" and "heaped tbsp/tablespoon(s)" are spellings of the heaping spoons, which count as a teaspoon and a tablespoon. A chunk counts through the piece weight.
  - The web test that read "1 컵 우유" as a glass now reads a cup: the later of two claims used to win in parse-ingredient's table.
  - Rung 2's container phrases lose "glas" and a few Korean words, and gain the jars', pouches' and sleeves' new names. `RUNG_VERSION` is not bumped, so nothing is re-resolved for it.
