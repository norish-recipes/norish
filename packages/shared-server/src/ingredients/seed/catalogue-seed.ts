/**
 * The catalogue seed (ADR-0038): the Open Food Facts taxonomy fetched nightly as seeded
 * Ingredients. Never a dependency: a failed fetch or bad file throws before applying anything.
 */
import type { IngredientSeedState } from "@norish/config/zod/server-config";
import type { SeedEntry, SeedOutcome } from "@norish/db/repositories/ingredient-seed";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { IngredientSeedStateSchema, ServerConfigKeys } from "@norish/config/zod/server-config";
import { withTransaction } from "@norish/db/drizzle";
import { mergeCatalogueIngredients } from "@norish/db/repositories/ingredient-relocation";
import {
  applyIngredientSeed,
  flagIngredient,
  listSeededIngredientIds,
  listUnseededSpellings,
} from "@norish/db/repositories/ingredient-seed";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
import { createLogger } from "@norish/shared-server/logger";
import { ingredients as ingredientsRealtime } from "@norish/shared-server/realtime/ingredients";
import { norishReads } from "@norish/shared/lib/ingredient-names";
import {
  ingredientAliasFold,
  stripPreparation,
  withoutStrayMarks,
} from "@norish/shared/lib/spelling-keys";

import { cleanIngredientText } from "../resolver";
import { parseTaxonomy } from "./parse-taxonomy";

const log = createLogger("ingredient-seed");

/** How long one fetch of the taxonomy may take: the file is a few megabytes. */
const FETCH_TIMEOUT_MS = 120_000;

/** The smallest share of the last seed's foods a new file must list to be applied. */
const MIN_KEPT_SHARE = 0.5;

/** The largest file read: a guard against a mirror serving something else entirely. */
const MAX_FILE_BYTES = 64 * 1024 * 1024;

/** A seeded text cleaned of stray marks ("3wu)" is "3wu"); its brackets tell foods apart, so they stay. */
function seedText(text: string): string {
  return withoutStrayMarks(cleanIngredientText(text));
}

/**
 * Spellings Open Food Facts gives the wrong entry, moved as each file is read (`to: null`: taken
 * off); raise `SEED_CORRECTIONS_VERSION` with each, for `correctSeedOnce`.
 */
export const SPELLING_MOVES: ReadonlyArray<{
  from: string;
  to: string | null;
  spellings: string[];
}> = [
  // Its coating also holds seasoning's names; a seasoning is a spice mix (ingredient-cleanup 21).
  {
    from: "en:coating",
    to: "en:mixed-spices",
    spellings: ["seasoning", "sazonador", "fűszerezés", "ochucující", "シーズニング"],
  },
  // Yam comes first in the file, so its Croatian "jam" took jam's own name (ingredient-cleanup 32).
  { from: "en:yam", to: "en:jam", spellings: ["jam"] },
  // AI's parent "steak" found patty by its French name; the file has no drumstick (ticket 52).
  { from: "en:patty", to: "en:beef-steak", spellings: ["steak"] },
  { from: "en:chicken-thigh", to: null, spellings: ["chicken drumstick"] },
];

/** 4: steak to beef steak, chicken drumstick off chicken thigh (ingredient-cleanup 52). */
export const SEED_CORRECTIONS_VERSION = 4;

/** The entries with each move made where the file has its food: no other entry keeps the spelling. */
function corrected(entries: readonly SeedEntry[]): SeedEntry[] {
  const offIds = new Set(entries.map((entry) => entry.offId));
  const owner = new Map<string, string | null>();

  for (const move of SPELLING_MOVES) {
    if (move.to && !offIds.has(move.to)) continue;
    for (const spelling of move.spellings) owner.set(ingredientAliasFold(spelling), move.to);
  }

  const moved = entries.flatMap((entry) => entry.aliases.filter((alias) => owner.has(alias.fold)));

  return entries.map((entry) => {
    const kept = entry.aliases.filter(
      (alias) => !owner.has(alias.fold) || owner.get(alias.fold) === entry.offId
    );
    const gained = moved.filter(
      (alias, index) =>
        owner.get(alias.fold) === entry.offId &&
        !kept.some((own) => own.fold === alias.fold) &&
        moved.findIndex((other) => other.fold === alias.fold) === index
    );

    return { ...entry, aliases: [...kept, ...gained] };
  });
}

/** A taxonomy file, read and folded into the entries the seed applies. */
export function seedEntriesOf(file: string): SeedEntry[] {
  return corrected(seedEntriesFrom(file));
}

function seedEntriesFrom(file: string): SeedEntry[] {
  return parseTaxonomy(file).flatMap((entry) => {
    const name = seedText(entry.name);

    if (!name) return [];

    return [
      {
        offId: entry.id,
        name,
        nameFold: ingredientAliasFold(name),
        parentOffId: entry.parentIds[0] ?? null,
        nutrition: entry.nutrition,
        // A spelling the entry's languages share goes to the first: one Norish reads (kaas nl, not af).
        aliases: norishFirst(entry.names).flatMap(({ text, locale }) => {
          const cleaned = seedText(text);

          return cleaned ? [{ text: cleaned, fold: ingredientAliasFold(cleaned), locale }] : [];
        }),
      },
    ];
  });
}

function norishFirst<T extends { locale: string | null }>(names: readonly T[]): T[] {
  return [...names].sort((a, b) => Number(norishReads(b.locale)) - Number(norishReads(a.locale)));
}

/** Apply entries already read from a taxonomy file, in one transaction. */
export async function applySeedEntries(entries: SeedEntry[]): Promise<{
  entries: SeedEntry[];
  outcome: SeedOutcome;
}> {
  const outcome = await applyIngredientSeed(entries);
  const { aliasCollisions, ...counts } = outcome;

  log.info({ entries: entries.length, ...counts }, "Ingredient catalogue seed applied");
  if (aliasCollisions.length > 0) {
    // Mostly one word meaning two foods across languages; the first claim holds.
    log.info(
      { count: aliasCollisions.length, sample: aliasCollisions.slice(0, 20) },
      "Seeded spellings another Ingredient already holds were left where they are"
    );
  }

  return { entries, outcome };
}

/**
 * The first seed's pass over older Ingredients, no AI: one whose spellings (or stripped ones) the
 * seed gives one entry merges into it, one it gives several is flagged.
 */
export async function mergeExistingIntoSeed(
  entries: readonly SeedEntry[]
): Promise<{ merged: number; flagged: number }> {
  const seeded = await listSeededIngredientIds();
  const entryByFold = new Map<string, string>();

  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (!entryByFold.has(alias.fold)) entryByFold.set(alias.fold, entry.offId);
    }
  }

  const targetsOf = new Map<string, Set<string>>();

  for (const spelling of await listUnseededSpellings()) {
    const bare = stripPreparation(spelling.text);
    const offId =
      entryByFold.get(spelling.fold) ?? (bare ? entryByFold.get(ingredientAliasFold(bare)) : null);
    const target = offId ? seeded.get(offId) : undefined;

    if (!target || target === spelling.ingredientId) continue;

    const targets = targetsOf.get(spelling.ingredientId) ?? new Set<string>();

    targets.add(target);
    targetsOf.set(spelling.ingredientId, targets);
  }

  let merged = 0;
  let flagged = 0;

  for (const [ingredientId, targets] of targetsOf) {
    if (targets.size === 1) {
      const [target] = targets;

      if (await withTransaction((tx) => mergeCatalogueIngredients(tx, ingredientId, target!))) {
        merged += 1;
      }
    } else {
      await flagIngredient(ingredientId);
      flagged += 1;
    }
  }

  log.info({ merged, flagged }, "Existing Ingredients merged into the catalogue seed");

  return { merged, flagged };
}

/** The last seed applied, as boot and the refresh read it: nothing applied yet reads as defaults. */
export async function readIngredientSeedState(): Promise<IngredientSeedState> {
  return IngredientSeedStateSchema.parse(
    (await getConfig<IngredientSeedState>(ServerConfigKeys.INGREDIENT_SEED_STATE)) ?? {}
  );
}

/**
 * Record part of the seed state, keeping the rest: what the startup passes
 * beside the seed (the re-check of old mints, the nutrition sources) note.
 */
export async function updateIngredientSeedState(
  patch: Partial<IngredientSeedState>
): Promise<void> {
  await setConfig(
    ServerConfigKeys.INGREDIENT_SEED_STATE,
    { ...(await readIngredientSeedState()), ...patch } satisfies IngredientSeedState,
    null,
    false
  );
}

/**
 * A startup pass once per `version` of the seed state's `key`, handed the version last run (0 for
 * none), recorded once through unless it answers null; null where run. Refetched on `changed`.
 */
export async function oncePerVersion<T extends object>(
  key: "rungVersion" | "cleanupVersion" | "correctionsVersion" | "junkSeedVersion",
  version: number,
  {
    pass,
    changed,
    done,
  }: { pass: (from: number) => Promise<T | null>; changed: (outcome: T) => boolean; done: string }
): Promise<T | null> {
  const from = (await readIngredientSeedState())[key];

  if (from === version) return null;

  const outcome = await pass(from);

  if (outcome === null) return null;

  const fields: Record<string, unknown> = { ...outcome, [key]: version };

  await updateIngredientSeedState({ [key]: version });
  log.info(fields, done);
  if (changed(outcome)) {
    await ingredientsRealtime.publish("changed", { ingredientIds: [] }, undefined);
  }

  return outcome;
}

export type RefreshResult = "disabled" | "unchanged" | "applied";

/**
 * Fetch the taxonomy, conditional on the last applied file's validators, and apply it where it
 * changed; the first applied seed is followed by `mergeExistingIntoSeed`.
 */
export async function refreshIngredientCatalogue(
  fetchImpl: typeof fetch = fetch
): Promise<RefreshResult> {
  const url = SERVER_CONFIG.INGREDIENT_CATALOGUE_URL;

  if (!url) return "disabled";

  const state = await readIngredientSeedState();
  const headers: Record<string, string> = {};

  if (state.etag) headers["If-None-Match"] = state.etag;
  if (state.lastModified) headers["If-Modified-Since"] = state.lastModified;

  const response = await fetchImpl(url, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (response.status === 304) {
    log.info({ url }, "Ingredient catalogue unchanged since the last seed");

    return "unchanged";
  }
  if (!response.ok) {
    throw new Error(`Fetching the ingredient catalogue failed: HTTP ${response.status}`);
  }
  if (Number(response.headers.get("content-length") ?? 0) > MAX_FILE_BYTES) {
    throw new Error("The ingredient catalogue is larger than Norish reads");
  }

  const file = await response.text();

  if (file.length > MAX_FILE_BYTES) {
    throw new Error("The ingredient catalogue is larger than Norish reads");
  }

  const read = seedEntriesOf(file);

  // A file that still parses but lists far fewer foods than the last one (a
  // truncated mirror) would read as every other food dropped upstream.
  if (read.length < state.entries * MIN_KEPT_SHARE) {
    throw new Error(
      `The ingredient catalogue lists ${read.length} foods, far fewer than the ${state.entries} of the last seed`
    );
  }

  const { entries, outcome } = await applySeedEntries(read);
  const firstSeed = !state.mergedExisting;
  const merged = firstSeed ? (await mergeExistingIntoSeed(entries)).merged : 0;

  // The validators are stored only once the file and the pass are through, so a failure retries in
  // full; after a first seed, `rungVersion: 0` rechecks the older mints against it.
  await updateIngredientSeedState({
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    appliedAt: new Date().toISOString(),
    entries: entries.length,
    mergedExisting: true,
    // A first seed is read with every correction, so none is left to make.
    ...(firstSeed ? { rungVersion: 0, correctionsVersion: SEED_CORRECTIONS_VERSION } : {}),
  });

  // Merges, parents and removals change which food lines mean: open clients
  // refetch what they derived from Ingredients, as after a person's merge.
  if (merged > 0 || outcome.parentsSet > 0 || outcome.removed > 0 || outcome.adopted > 0) {
    await ingredientsRealtime.publish("changed", { ingredientIds: [] }, undefined);
  }

  return "applied";
}
