# 10: An archive keeps each line's food

**What to build:** A Recipe Archive round trip keeps the foods each recipe line names, not only its text. Today the Norish writer exports a line's text with `ingredientId: null` (`packages/shared-server/src/archive/norish-writer.ts`), and import resolves the food again from that text. So a line whose text is no longer a spelling of its food imports as a new food when AI is off. Ticket 03 makes that common: removing a spelling moves its lines onto another spelling of the same food.

The writer exports each line's foods as the spellings they point at, in order. The Norish parser hands them to the resolver, the way the Mealie and Tandoor importers already hand over `foodText` (`withLineFoodTexts` in `parser-helpers.ts`).

**Blocked by:** 04, so the archive carries every food a line names.

**Status:** done

- [x] A line whose spelling was removed, its food kept under another spelling, round-trips to the same food with AI off.
- [x] A line naming several foods round-trips with all of them, in order.
- [x] An archive without foods imports as it does today.
- [x] All `CONTRIBUTING.md` gates pass.

## Comments

2026-10-20, done in 263fd0855 (one `joinOf` helper for the five places that keep a join only for several foods) and 8c7854db9.

- The full recipe DTO now gives every line its `foods` with their spellings, not only lines naming several, because the writer needs a single food's spelling too. `foodsToBuy` still reads `foods` only when `joined` is set, and no other reader uses it. Every recipe and share payload now carries each line's spelling.
- Each archive line carries `foods` (spellings, in order) and `joined`, added within format version 1. The Norish parser hands them to the resolver as `foodTexts`, the field `foodText` became for Mealie and Tandoor too. One spelling is resolved as Mealie's food name is. Several with a join are resolved a food each (`resolveParts`), with no split of their own. Several without a join read the first only.
- The test respells by renaming the food as well: a mint takes over a food with the same name, so within one database a removed spelling alone still finds its food.
- `pnpm test:run` went red twice in suites this change does not reach, and passed the first time. Run 2 hit two auth `beforeAll` timeouts (60 s) and the paste-import worker test (265 s; it mocks `recipe-lines`). Run 3 hit two `create-worker-redis` timeouts. Each passes alone, and the queue package passes whole in 16 s. The load average was about 10. Not diagnosed.
- Not done: the Recipe Archive docs page says nothing about ingredients and was left alone. ADR-0022 has no amendment for the new fields.
