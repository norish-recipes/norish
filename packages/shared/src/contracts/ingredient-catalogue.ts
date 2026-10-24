/**
 * Why the catalogue of Ingredients refused an edit (ADR-0037). The server
 * throws one of these and the Ingredients page translates it, so both read
 * the one list.
 */
export const CATALOGUE_REFUSALS = [
  "forbidden",
  "not-found",
  "name-taken",
  "spelling-taken",
  "last-alias",
  "same-ingredient",
  "cycle",
  "empty",
] as const;

export type CatalogueRefusal = (typeof CATALOGUE_REFUSALS)[number];

export function isCatalogueRefusal(value: unknown): value is CatalogueRefusal {
  return (CATALOGUE_REFUSALS as readonly unknown[]).includes(value);
}

/**
 * Why an Ingredient is flagged (ADR-0037): what the resolver, the upgrade or
 * the seed knew when it minted or marked it. The Ingredients page shows the
 * reason beside the flag so a person knows what to check.
 */
export const FLAG_REASONS = [
  /** No known food shared a word with the name, so AI was not asked. No longer set; old rows keep it. */
  "unknown-food",
  /** AI was asked and was not sure. */
  "ai-unsure",
  /** AI or a slip named a food that was merged away before the name could join it. */
  "food-gone",
  /** Minted by the upgrade to the catalogue, which asks no AI. */
  "upgrade",
  /** The catalogue seed found several foods its spellings could be. */
  "seed-ambiguous",
  /** AI says this is not a food, and a Pantry Ingredient keeps it. */
  "ai-junk",
] as const;

export type FlagReason = (typeof FLAG_REASONS)[number];

/** Why AI gave no answer about a food: switched off, unreachable, or its key refused. Never a flag. */
export type UnansweredReason = "ai-off" | "ai-unavailable" | "ai-key-rejected";

export function isFlagReason(value: unknown): value is FlagReason {
  return (FLAG_REASONS as readonly unknown[]).includes(value);
}

/**
 * What an AI Change did: merged a food into another, filed it under a parent, gave it its Plain
 * Name, deleted it as not a food, or removed or moved a spelling that does not name its food.
 */
export const AI_CHANGE_KINDS = ["merge", "parent", "plain-name", "not-a-food", "spelling"] as const;

export type AIChangeKind = (typeof AI_CHANGE_KINDS)[number];

/**
 * What asking AI about an Ingredient came to, with what AI tried (`ReviewTrace`). `unsure` and
 * `unanswered` changed nothing: AI doubted the food is its own, or no answer came.
 */
export type ReviewOutcome = ReviewVerdict & ReviewTrace;

export type ReviewVerdict =
  | { outcome: "merge"; into: string; sure: boolean }
  | { outcome: "parent"; of: string; sure: boolean }
  | { outcome: "no-parent"; from: string; sure: boolean }
  | { outcome: "rename"; to: string }
  | { outcome: "split"; into: string[] }
  | { outcome: "not-a-food" }
  | { outcome: "distinct" }
  | { outcome: "unsure"; reason: FlagReason }
  | { outcome: "unanswered"; reason: UnansweredReason }
  | { outcome: "skipped"; reason: "decided" | "undone" | "not-found" | "cycle" | "seeded" };

export interface ReviewTrace {
  /** The plain English food AI read the name as, when it said. */
  englishName: string | null;
  /** The plain foods AI said it is made of or sold as, its parents, in English. */
  parents: string[];
  /** Those parents in the name's own language. */
  nativeParents: string[];
  /** The general group AI said it belongs under, filed under where no parent is found. */
  category: string | null;
  /** The other names AI said a shop sells it under. */
  otherNames: string[];
  /** The foods AI read the name as several of, when it did. */
  parts: string[] | null;
  /** The foods AI's names found when they found several, which AI then chose between. */
  considered: string[];
}

/** A trace before AI said anything. */
export function noTrace(): ReviewTrace {
  return {
    englishName: null,
    parents: [],
    nativeParents: [],
    category: null,
    otherNames: [],
    parts: null,
    considered: [],
  };
}
