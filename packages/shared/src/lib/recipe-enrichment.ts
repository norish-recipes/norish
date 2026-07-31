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
  "recipe-provenance",
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
  /** Identifies the retained run so out-of-order realtime events cannot regress a newer state. */
  runId: string | null;
  /** Monotonic within a kind's queue; orders reruns whose UUIDs cannot express freshness. */
  runSequence: number | null;
}

/** Authoritative initial/recovery read: one entry per kind, always all of them. */
export interface RecipeEnrichmentStatusDto {
  recipeId: string;
  kinds: RecipeEnrichmentKindStatus[];
}

/** One typed lifecycle event shape for every kind and transition. */
export interface RecipeEnrichmentLifecycleEventDto {
  recipeId: string;
  /** Unique per enrollment, including reruns of the same recipe and kind. */
  runId: string;
  /** Monotonic within this kind's queue, so older-run events can be discarded. */
  runSequence: number;
  kind: RecipeEnrichmentKind;
  state: Exclude<RecipeEnrichmentLifecycleState, "idle">;
  origin: RecipeEnrichmentOrigin;
  /** Set only on manual terminal failure, so targeted feedback does not disclose it otherwise. */
  requestedByUserId?: string;
}

function includesString<T extends readonly string[]>(
  values: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

/** Runtime guard for the realtime boundary, whose envelope payload is untrusted. */
export function isRecipeEnrichmentLifecycleEvent(
  value: unknown
): value is RecipeEnrichmentLifecycleEventDto {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  const needsRequester = candidate.origin === "manual" && candidate.state === "failed";
  const hasValidRequester =
    (needsRequester && typeof candidate.requestedByUserId === "string") ||
    (!needsRequester && candidate.requestedByUserId === undefined);

  return (
    typeof candidate.recipeId === "string" &&
    typeof candidate.runId === "string" &&
    candidate.runId.length > 0 &&
    Number.isSafeInteger(candidate.runSequence) &&
    (candidate.runSequence as number) >= 0 &&
    includesString(ENRICHMENT_KINDS, candidate.kind) &&
    includesString(ENRICHMENT_LIFECYCLE_STATES, candidate.state) &&
    candidate.state !== "idle" &&
    (candidate.origin === "automatic" || candidate.origin === "manual") &&
    hasValidRequester
  );
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

/** Recipe Provenance as proposed: any field may be absent or blank. */
export interface ProvenanceGroupInput {
  originCountry?: string | null;
  originRegion?: string | null;
  provenanceNote?: string | null;
  /** Resolved Cuisine names, or the rows themselves when reading a stored recipe. */
  cuisines?: readonly (string | { name?: string | null } | null | undefined)[] | null;
}

/**
 * Recipe Provenance as stored.
 *
 * The country is an ISO-3166-1 alpha-2 code so the client can localise it; the
 * region and the note are free text and are never translated. Cuisines are not
 * part of this shape because they are join rows rather than columns.
 */
export interface ProvenanceGroup {
  originCountry: string | null;
  originRegion: string | null;
  provenanceNote: string | null;
}

export const EMPTY_PROVENANCE_GROUP: ProvenanceGroup = {
  originCountry: null,
  originRegion: null,
  provenanceNote: null,
};

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * An ISO-3166-1 alpha-2 code, or null.
 *
 * The country is stored as a code and never as a display name, so anything that
 * is not two letters is not a country code and is discarded rather than
 * rendered as a broken flag.
 */
export function normalizeOriginCountry(value: string | null | undefined): string | null {
  const trimmed = normalizeText(value);

  if (trimmed === null || !/^[A-Za-z]{2}$/.test(trimmed)) return null;

  return trimmed.toUpperCase();
}

/** True when at least one Cuisine name survives normalization. */
export function hasSubstantiveCuisines(cuisines: ProvenanceGroupInput["cuisines"]): boolean {
  if (!cuisines) return false;

  return cuisines.some((cuisine) => {
    const name = typeof cuisine === "string" ? cuisine : cuisine?.name;

    return normalizeText(name) !== null;
  });
}

/**
 * Recipe Provenance is one atomic precedence group: any substantive value among
 * the country, the region, the Cuisines, and the note makes the stored group
 * authoritative, following the precedent set by Nutrition Information.
 *
 * Atomicity is deliberate. The note explains the whole claim, so letting AI fill
 * Cuisines beside a human-set country would store a paragraph arguing against
 * the field next to it.
 */
export function hasSubstantiveProvenance(provenance: ProvenanceGroupInput): boolean {
  return (
    normalizeOriginCountry(provenance.originCountry) !== null ||
    normalizeText(provenance.originRegion) !== null ||
    normalizeText(provenance.provenanceNote) !== null ||
    hasSubstantiveCuisines(provenance.cuisines)
  );
}

/**
 * Normalize a proposed Recipe Provenance group for replacement.
 * Omitted, blank, and malformed fields become null because replacement cannot
 * mix an old claim with a new one.
 */
export function normalizeProvenanceGroup(provenance: ProvenanceGroupInput): ProvenanceGroup {
  return {
    originCountry: normalizeOriginCountry(provenance.originCountry),
    originRegion: normalizeText(provenance.originRegion),
    provenanceNote: normalizeText(provenance.provenanceNote),
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
