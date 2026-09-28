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

/** What asking AI about a Flagged Ingredient came to, as the procedure answers it. */
export type ReviewOutcome =
  | { outcome: "merged"; into: string }
  | { outcome: "parent"; of: string }
  | { outcome: "distinct" }
  | { outcome: "unsure"; reason: FlagReason }
  | { outcome: "not-flagged" };
