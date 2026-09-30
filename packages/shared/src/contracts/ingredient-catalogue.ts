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
  "alias-in-use",
  "ingredient-in-use",
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
  /** AI is switched off, so nothing vouched for the name. */
  "ai-off",
  /** No known food shares a word with the name, so AI was not asked. */
  "unknown-food",
  /** AI was asked and was not sure. */
  "ai-unsure",
  /** AI did not answer in time, or failed. */
  "ai-unavailable",
  /** AI named a food that was merged away before the name could join it. */
  "food-gone",
  /** Minted by the upgrade to the catalogue, which asks no AI. */
  "upgrade",
  /** The catalogue seed found several foods its spellings could be. */
  "seed-ambiguous",
] as const;

export type FlagReason = (typeof FLAG_REASONS)[number];

export function isFlagReason(value: unknown): value is FlagReason {
  return (FLAG_REASONS as readonly unknown[]).includes(value);
}

/**
 * What AI may propose for an Ingredient (ADR-0037): that it is another food
 * (`merge`), a kind of another food (`parent`), or a food of its own
 * (`distinct`). AI never makes the edit itself; a person confirms or
 * dismisses the suggestion.
 */
export const SUGGESTION_KINDS = ["merge", "parent", "distinct"] as const;

export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

/**
 * What asking AI about an Ingredient came to, as the procedure answers it,
 * with what was asked: the foods the name was compared with and what AI read
 * the name as, so a person can see what AI tried. A sure answer is a
 * suggestion waiting on a person, named here by the food it proposes.
 */
export type ReviewOutcome = ReviewVerdict & ReviewTrace;

export type ReviewVerdict =
  | { outcome: "merge"; into: string }
  | { outcome: "parent"; of: string }
  | { outcome: "distinct" }
  | { outcome: "unsure"; reason: FlagReason }
  | { outcome: "not-flagged" };

export interface ReviewTrace {
  /** The names of the foods AI was asked to compare the name with, in order. */
  considered: string[];
  /** The plain English food AI read the name as, when it said. */
  englishName: string | null;
}

/**
 * What a round of Ask AI came to for one food, as the round's report reads
 * it back: the suggestion and the food it names with what was asked
 * (`ReviewTrace`); or why the food was passed over; or what broke. The
 * worker records one per step, and the Ingredients page lists the foods
 * that got no suggestion beside the ones waiting to be confirmed.
 */
export type ReviewReportEntry = { ingredientId: string; name?: string } & (
  | ({ outcome: "merge"; into: string } & ReviewTrace)
  | ({ outcome: "parent"; of: string } & ReviewTrace)
  | ({ outcome: "distinct" } & ReviewTrace)
  | ({ outcome: "unsure"; reason: string } & ReviewTrace)
  | { outcome: "skipped"; reason: "not-flagged" | "forbidden" | "not-found" }
  | { outcome: "failed"; error: string }
);

/** A round of Ask AI read back: what it came to for each food, in the order it took them. */
export interface ReviewReport {
  jobId: string;
  finished: boolean;
  entries: ReviewReportEntry[];
}
