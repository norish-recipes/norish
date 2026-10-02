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

**Status:** ready-for-agent

- [ ] A test over `packages/config/src/units.default.json` fails when two entries claim the same folded word, whether as id, short form, plural or alternate.
- [ ] Each of the 68 shared words has one owner. The owners that change a count:
  - stuk, stuks, Stück, Stücke, pezzo and pezzi → piece;
  - scheutje and scheutjes → splash;
  - dozen → dozen.

  Review picks the rest.
- [ ] "1 T olive oil" stores and counts as a tablespoon and "1 t salt" as a teaspoon, through import, paste import, manual entry and groceries (`normalizeUnit` and `resolveUnit`).
- [ ] "2 heaped tsp cumin seeds" and "4 heaped tbsp Greek-style yogurt" store as teaspoons and tablespoons.
- [ ] A line stored as `chunk` counts through the piece weight, like clove and slice.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, from the spoon-measures grill:
  - An administrator's overridden map is not rewritten, so its shared words keep resolving by key order; the test guards the default file.
  - Lines already stored keep their unit. An old "T" line can't be told from a real teaspoon and stays one.
  - The dev database's "2 heaped tsp cumin seeds" was stored with no unit and read as two pieces.
