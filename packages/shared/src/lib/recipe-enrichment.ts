/**
 * Recipe Enrichment vocabulary and normalization.
 *
 * One place decides what counts as Supplied Recipe Data, because the same
 * "is this value substantive?" question drives automatic eligibility, the
 * conditional repository writes, and the worker's own output validation.
 * Null, whitespace-only, and empty values are absent everywhere.
 */

export const ENRICHMENT_KINDS = [
  "auto-tagging",
  "allergy-detection",
  "auto-categorization",
  "nutrition-estimation",
] as const;

export type RecipeEnrichmentKind = (typeof ENRICHMENT_KINDS)[number];

export const ENRICHMENT_LIFECYCLE_STATES = [
  "idle",
  "queued",
  "processing",
  "succeeded",
  "failed",
] as const;

export type RecipeEnrichmentLifecycleState = (typeof ENRICHMENT_LIFECYCLE_STATES)[number];

/** Whether a run was enrolled automatically for a newly usable recipe or requested by an editor. */
export type RecipeEnrichmentOrigin = "automatic" | "manual";

/** Why the coordinator declined to enroll a kind. */
export type RecipeEnrichmentSkipReason =
  /** Global AI enablement is the top-level prerequisite for automatic and manual alike. */
  | "ai-disabled"
  /** The recipe could not be loaded, so there is nothing to enrich. */
  | "recipe-unavailable"
  /** This kind's automatic switch is off. Never applies to a manual request. */
  | "automatic-disabled"
  /** The stored recipe lacks the input this kind needs; the recipe itself is fine. */
  | "insufficient-input"
  /** Allergy detection has nothing to look for. */
  | "no-household-allergies"
  /** Substantive Supplied Recipe Data outranks automatic replacement. */
  | "supplied-data-present";

/** Per-kind coordinator outcome. Automatic enrollment never waits for the job itself. */
export type RecipeEnrichmentEnrollment =
  | { kind: RecipeEnrichmentKind; status: "queued"; jobId: string }
  | { kind: RecipeEnrichmentKind; status: "duplicate"; existingJobId: string }
  | { kind: RecipeEnrichmentKind; status: "skipped"; reason: RecipeEnrichmentSkipReason }
  | { kind: RecipeEnrichmentKind; status: "failed-to-queue"; error: string };

export interface RecipeEnrichmentKindStatus {
  kind: RecipeEnrichmentKind;
  state: RecipeEnrichmentLifecycleState;
  origin: RecipeEnrichmentOrigin | null;
}

/** Authoritative initial/recovery read: one entry per kind, always all four. */
export interface RecipeEnrichmentStatusDto {
  recipeId: string;
  kinds: RecipeEnrichmentKindStatus[];
}

/** One typed lifecycle event shape for every kind and transition. */
export interface RecipeEnrichmentLifecycleEventDto {
  recipeId: string;
  kind: RecipeEnrichmentKind;
  state: Exclude<RecipeEnrichmentLifecycleState, "idle">;
  origin: RecipeEnrichmentOrigin;
  /** Only set for manual runs, so a terminal failure can be reported to the requester alone. */
  requestedByUserId?: string;
}

export interface NutritionGroupInput {
  calories?: number | string | null;
  fat?: number | string | null;
  carbs?: number | string | null;
  protein?: number | string | null;
}

/** Nutrition Information as stored: calories is an integer, the macros are decimal strings. */
export interface NutritionGroup {
  calories: number | null;
  fat: string | null;
  carbs: string | null;
  protein: string | null;
}

export const EMPTY_NUTRITION_GROUP: NutritionGroup = {
  calories: null,
  fat: null,
  carbs: null,
  protein: null,
};

function normalizeNumeric(value: number | string | null | undefined): number | null {
  if (value == null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  const trimmed = value.trim();

  if (trimmed === "") return null;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** True when at least one category survives normalization. */
export function hasSubstantiveCategories(
  categories: readonly (string | null | undefined)[] | null | undefined
): boolean {
  if (!categories) return false;

  return categories.some((category) => typeof category === "string" && category.trim() !== "");
}

/**
 * Nutrition Information is one atomic precedence group: any substantive value
 * among the four fields makes the stored group authoritative.
 */
export function hasSubstantiveNutrition(nutrition: NutritionGroupInput): boolean {
  return (
    normalizeNumeric(nutrition.calories) !== null ||
    normalizeNumeric(nutrition.fat) !== null ||
    normalizeNumeric(nutrition.carbs) !== null ||
    normalizeNumeric(nutrition.protein) !== null
  );
}

/**
 * Normalize a proposed Nutrition Information group for replacement.
 * Omitted, blank, and non-numeric fields become null because replacement
 * cannot mix an old estimate with a new one.
 */
export function normalizeNutritionGroup(nutrition: NutritionGroupInput): NutritionGroup {
  const calories = normalizeNumeric(nutrition.calories);
  const fat = normalizeNumeric(nutrition.fat);
  const carbs = normalizeNumeric(nutrition.carbs);
  const protein = normalizeNumeric(nutrition.protein);

  return {
    calories: calories === null ? null : Math.round(calories),
    fat: fat === null ? null : String(fat),
    carbs: carbs === null ? null : String(carbs),
    protein: protein === null ? null : String(protein),
  };
}

/** Trim, drop blanks, and deduplicate case-insensitively, keeping the first spelling. */
export function normalizeEnrichmentTagNames(
  names: readonly (string | null | undefined)[]
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const name of names) {
    if (typeof name !== "string") continue;

    const trimmed = name.trim();

    if (trimmed === "") continue;

    const key = trimmed.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

/**
 * Map a retained BullMQ job state onto the shared lifecycle vocabulary.
 * No retained job means `idle`, so configured retention removal naturally
 * returns the recipe to `idle` without a second lifecycle table.
 */
export function toEnrichmentLifecycleState(
  jobState: string | null | undefined
): RecipeEnrichmentLifecycleState {
  switch (jobState) {
    case "waiting":
    case "waiting-children":
    case "delayed":
    case "prioritized":
    case "paused":
      return "queued";
    case "active":
      return "processing";
    case "completed":
      return "succeeded";
    case "failed":
      return "failed";
    default:
      return "idle";
  }
}
