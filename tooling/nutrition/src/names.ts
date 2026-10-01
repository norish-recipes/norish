import type { Macros } from "./read/values";

/**
 * Matching a taxonomy entry to a dataset food by name (ADR-0039), for the
 * entries no code gives numbers: an exact match on the folded name, then on
 * the normalised one, never fuzzy and never by head noun (57% and 75%
 * precision on hand-checked samples). Run here, in the build script, so a
 * match reaches instances only through a reviewed pull request.
 */

/** Lowercase, accents folded, punctuation gone: "Oignon, cru" and "oignon cru" are one name. */
export function foldFoodName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Words that only join others. */
const FILLER = new Set([
  "of",
  "the",
  "a",
  "with",
  "in",
  "de",
  "du",
  "des",
  "d",
  "la",
  "le",
  "les",
  "l",
  "avec",
  "en",
  "au",
  "aux",
  "and",
  "et",
  "or",
  "ou",
]);

/**
 * Words that say a food is in its usual state, and so do not change which
 * food it is. Words that do ("whole", "dried", "cooked", "powder", "smoked",
 * "salted") are kept: "whole rice flour" is not rice flour.
 */
const USUAL_STATE = new Set([
  "raw",
  "cru",
  "crue",
  "crus",
  "crues",
  "fresh",
  "frais",
  "fraiche",
  "fraiches",
  "average",
  "aliment",
  "moyen",
  "plain",
  "nature",
  "pulp",
  "flesh",
  "unprepared",
  "uncooked",
]);

/** English and French plurals made singular, plainly: "onions", "tomatoes", "berries", "noix". */
function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes|zes|oes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("aux")) return `${word.slice(0, -3)}al`;
  if (/[^su]s$/.test(word)) return word.slice(0, -1);

  return word;
}

/**
 * The normalised name: brackets, filler and usual-state words dropped, the
 * rest singular and compared in any order, each as often as it occurs.
 * "Onions, red, raw" and "red onion" normalise alike; "Rice flour" and
 * "whole rice flour" do not, nor "Tomato juice" and "tomatoes in tomato juice".
 */
export function normaliseFoodName(name: string): string {
  const words = foldFoodName(name.replace(/\([^)]*\)|\[[^\]]*\]/g, " "))
    .split(" ")
    .filter((word) => word !== "" && !FILLER.has(word) && !USUAL_STATE.has(word))
    .map(singular);

  return words.sort().join(" ");
}

/** Several foods behind one key are one answer only when their calories agree within 10% (or 15 kcal). */
export function caloriesAgree(foods: ReadonlyArray<Pick<Macros, "kcal">>): boolean {
  const kcal = foods.map((food) => food.kcal);
  const high = Math.max(...kcal);
  const low = Math.min(...kcal);

  return high - low <= Math.max(15, high * 0.1);
}

/** A source's foods, indexed by both keys. */
export interface NameIndex<F> {
  exact: Map<string, F[]>;
  normalised: Map<string, F[]>;
}

export function indexByName<F extends { name: string }>(foods: readonly F[]): NameIndex<F> {
  const exact = new Map<string, F[]>();
  const normalised = new Map<string, F[]>();
  const add = (map: Map<string, F[]>, key: string, food: F) => {
    if (key === "") return;

    const list = map.get(key) ?? [];

    if (!list.includes(food)) list.push(food);
    map.set(key, list);
  };

  for (const food of foods) {
    add(exact, foldFoodName(food.name), food);
    add(normalised, normaliseFoodName(food.name), food);
  }

  return { exact, normalised };
}

/**
 * The food an entry's names match, trying every source at the exact rung
 * before any at the normalised one, the sources in the order given (CIQUAL,
 * then USDA, then CoFID). The first rung and source with candidates decides:
 * the candidates' calories agree and the first is taken, or they disagree
 * and the entry has no match.
 */
export function matchByName<F extends Macros & { name: string }>(
  names: readonly string[],
  sources: ReadonlyArray<NameIndex<F>>
): F | null {
  for (const rung of ["exact", "normalised"] as const) {
    const key = rung === "exact" ? foldFoodName : normaliseFoodName;
    const keys = [...new Set(names.map(key).filter((value) => value !== ""))];

    for (const source of sources) {
      const candidates = [...new Set(keys.flatMap((value) => source[rung].get(value) ?? []))];

      if (candidates.length === 0) continue;

      return caloriesAgree(candidates) ? candidates[0]! : null;
    }
  }

  return null;
}
