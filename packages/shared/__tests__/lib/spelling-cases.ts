/**
 * Whether a Pantry Ingredient covers a line by spelling alone, as the
 * resolver's first two rungs decide it online: [the Pantry's text, the
 * line's text, covered]. Checked offline by `spelling-keys.test.ts` and
 * online, against the real resolver, by shared-server's `spelling-keys.test.ts`,
 * so the two can never disagree about these. Both read the default units
 * map, whose phrases rung 2 strips from either end of a text.
 */
export const SPELLING_CASES: ReadonlyArray<readonly [string, string, boolean]> = [
  ["onions", "onions", true],
  ["onions", "Onions!", true],
  ["onions", "onions, diced", true],
  ["onions", "onions (red)", true],
  ["onions", "onions [2]", true],
  ["onions, diced", "onions", true],
  ["onions, diced", "onions, sliced", true],
  ["onions (red)", "onions, sliced", true],
  ["Crème fraîche", "creme fraiche", true],
  ["onion", "onions", false],
  ["salt", "salted butter", false],
  ["red onion", "onion", false],
  ["!!!", "!!!", true],
  ["!!!", "???", false],
  ["salt", "salt to taste", true],
  ["salt", "Salt, to taste", true],
  ["nutmeg", "a pinch of nutmeg", true],
  ["zout", "naar smaak zout", true],
  ["sweet chilli sauce", "sweet chilli sauce to serve", true],
  ["parsley", "parsley for garnish", true],
  ["chilli flakes", "chilli flakes (optional)", true],
  ["chilli flakes", "chilli flakes optional", true],
  ["salt", "salt and pepper to taste", false],
  ["cream", "cream to taste with sugar", false],
];
