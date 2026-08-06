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
  "ingredient-linking",
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
  /** Supplied Recipe Data already answers everything this kind could add. */
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
 * Nutrition Information is one atomic precedence group, and it counts as
 * substantive only when the whole group is present: calories, fat, carbs, and
 * protein. Zero is a value; null and blank are absence.
 *
 * Completeness cuts both ways. A stored group missing values — an import that
 * stated only calories — does not outrank a complete estimate, so automatic
 * estimation can finish it; and an estimate missing values is unusable,
 * because replacement writes all four fields and would null out the rest.
 */
export function hasSubstantiveNutrition(nutrition: NutritionGroupInput): boolean {
  return (
    normalizeNumeric(nutrition.calories) !== null &&
    normalizeNumeric(nutrition.fat) !== null &&
    normalizeNumeric(nutrition.carbs) !== null &&
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
  originCountryName?: string | null;
  originRegion?: string | null;
  provenanceNote?: string | null;
  /** Resolved Cuisine names, or the rows themselves when reading a stored recipe. */
  cuisines?: readonly (string | { name?: string | null } | null | undefined)[] | null;
}

/**
 * Recipe Provenance as stored.
 *
 * The country is an ISO-3166-1 alpha-2 code — authoritative for flags — beside
 * its written name, which is recipe content: inference writes it in the
 * recipe's language, a manual pick stores the label the editor saw. The region
 * and the note are free text. None of the written fields is translated.
 * Cuisines are not part of this shape because they are join rows rather than
 * columns.
 */
export interface ProvenanceGroup {
  originCountry: string | null;
  originCountryName: string | null;
  originRegion: string | null;
  provenanceNote: string | null;
}

export const EMPTY_PROVENANCE_GROUP: ProvenanceGroup = {
  originCountry: null,
  originCountryName: null,
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
 * True when the group holds any substantive value at all — a country, a
 * region, a note, or one Cuisine.
 *
 * This is the presence question: it validates that a claim proposes something
 * and that a stored group is worth rendering. It is not the precedence
 * question — automatic runs fill the group's gaps per slot, and only
 * {@link hasCompleteProvenance} says there are none left (ADR-0018).
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
 * True when the group has answered everything an automatic run could ask:
 * a country, a note, and at least one Cuisine (ADR-0018).
 *
 * The region is deliberately not counted. Its absence is a valid answer — a
 * national dish has none — so an absent region is indistinguishable from an
 * answered one and cannot demand a run. The written country name is cosmetic
 * (the endonym fallback renders without it) and cannot demand one either;
 * both are still filled opportunistically when a run happens anyway.
 */
export function hasCompleteProvenance(provenance: ProvenanceGroupInput): boolean {
  return (
    normalizeOriginCountry(provenance.originCountry) !== null &&
    normalizeText(provenance.provenanceNote) !== null &&
    hasSubstantiveCuisines(provenance.cuisines)
  );
}

/**
 * Normalize a proposed Recipe Provenance group for replacement.
 * Omitted, blank, and malformed fields become null because replacement cannot
 * mix an old claim with a new one. The written country name is the code's
 * companion: without a code there is no country to name, so the name is
 * dropped with it.
 */
export function normalizeProvenanceGroup(provenance: ProvenanceGroupInput): ProvenanceGroup {
  const originCountry = normalizeOriginCountry(provenance.originCountry);

  return {
    originCountry,
    originCountryName: originCountry === null ? null : normalizeText(provenance.originCountryName),
    originRegion: normalizeText(provenance.originRegion),
    provenanceNote: normalizeText(provenance.provenanceNote),
  };
}

/** What one automatic Recipe Provenance run should write, decided per slot. */
export interface ProvenanceGapFill {
  /** The group to store: supplied slots verbatim, absent slots from the claim. */
  group: ProvenanceGroup;
  /** Whether the claim's Cuisines should be written. Never true while any are stored. */
  fillCuisines: boolean;
  /** Whether applying the fill changes anything at all; false means defer. */
  changed: boolean;
}

/**
 * Merge an inferred claim into a stored Recipe Provenance group, filling only
 * its gaps (ADR-0018).
 *
 * The group has four slots — the country with its written name, the region,
 * the note, and the Cuisine set — and a slot holding any substantive value is
 * supplied: it is kept byte-for-byte, never replaced. An absent slot is filled
 * from the claim. A complete group (per {@link hasCompleteProvenance}) changes
 * nothing at all, so a group finished while the request was in flight also
 * keeps its absent region rather than gaining one nobody asked for.
 *
 * The claim's scalars argue for the claim's country, so the region, the note,
 * and the written name fill only when the country they would sit beside is the
 * one the claim named. Inference is told the supplied slots, so normally the
 * countries agree; when they do not — the model ignored them, or the country
 * arrived while the request was in flight — those slots stay empty rather
 * than argue with the field next to them. Cuisines are not country-bound — a
 * fusion dish's traditions span countries — and fill whenever none are stored.
 */
export function fillProvenanceGaps(
  stored: ProvenanceGroupInput,
  claim: ProvenanceGroupInput
): ProvenanceGapFill {
  const group: ProvenanceGroup = {
    originCountry: stored.originCountry ?? null,
    originCountryName: stored.originCountryName ?? null,
    originRegion: stored.originRegion ?? null,
    provenanceNote: stored.provenanceNote ?? null,
  };

  if (hasCompleteProvenance(stored)) {
    return { group, fillCuisines: false, changed: false };
  }

  const proposed = normalizeProvenanceGroup(claim);
  const storedCountry = normalizeOriginCountry(stored.originCountry);
  // The country the claim's scalars would end up beside.
  const countryAgrees = (storedCountry ?? proposed.originCountry) === proposed.originCountry;
  let changed = false;

  if (storedCountry === null && proposed.originCountry !== null) {
    group.originCountry = proposed.originCountry;
    group.originCountryName = proposed.originCountryName;
    changed = true;
  } else if (
    storedCountry !== null &&
    countryAgrees &&
    normalizeText(stored.originCountryName) === null &&
    proposed.originCountryName !== null
  ) {
    // The written name is the code's companion: beside a supplied code it may
    // be backfilled only from a claim that names the same country.
    group.originCountryName = proposed.originCountryName;
    changed = true;
  }

  if (
    countryAgrees &&
    normalizeText(stored.originRegion) === null &&
    proposed.originRegion !== null
  ) {
    group.originRegion = proposed.originRegion;
    changed = true;
  }

  if (
    countryAgrees &&
    normalizeText(stored.provenanceNote) === null &&
    proposed.provenanceNote !== null
  ) {
    group.provenanceNote = proposed.provenanceNote;
    changed = true;
  }

  const fillCuisines =
    !hasSubstantiveCuisines(stored.cuisines) && hasSubstantiveCuisines(claim.cuisines);

  return { group, fillCuisines, changed: changed || fillCuisines };
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
