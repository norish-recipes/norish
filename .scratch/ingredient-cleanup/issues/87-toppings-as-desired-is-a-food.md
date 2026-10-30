# 87: "toppings as desired" is a food

**What to build:** After ticket 86 the upgrade check on the production copy kept one kept-distinct junk food: "toppings", named by lines "toppings as desired". "as desired" was no serving phrase in English (most languages had one: "naar wens", "nach Wunsch", "à volonté"), and "toppings" no junk word, so the line named a food.

**Blocked by:** 86

**Status:** done

## Decided (Mike, 2026-10-27)

"sounds good": "as desired" as a serving phrase in every language that lacks one, and "toppings" on the junk pile seed.

## Implemented (2026-10-27)

- `units.default.json`: `optional` gains "as desired", "a voluntad", "à vontade", "według uznania", "efter ønske", "etter ønske", "efter önskan", "원하는 만큼" (the languages without an "as desired" phrase); `to_taste` gains "as needed" beside "nach Bedarf" and "efter behov".
- `junk-pile.ts`: a `toppings` concept, version 2, in every catalogue language ("toppings", "Toppings", "garnitures", "coberturas", "dodatki", "täytteet", "toppingar", …), seeded once on an instance's next start. `JUNK_SEED_VERSION` 2.
- Tests: `spelling-keys.test.ts` ("toppings as desired", "water, as needed", "kaas naar wens"), `catalogue-seed.test.ts` (seed count 234), `first-start-cleanup.test.ts` (a "toppings as desired" own food goes).
- Docs: release notes (Text that is not a food, Units), pt-BR.
