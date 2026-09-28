/**
 * The ingredient catalogue seed (ADR-0038): the Open Food Facts ingredients
 * taxonomy, fetched nightly and applied as seeded Ingredients, aliases and
 * parents, so a new instance already knows that "ui" is "onion".
 *
 * The seed is an improvement, never a dependency: with no URL, or no
 * internet, Norish resolves names without it. A fetch that fails, or a file
 * that does not read as a taxonomy, throws before anything is applied, so the
 * last good seed stays and the job monitor shows the failure.
 */
import type { IngredientSeedState } from "@norish/config/zod/server-config";
import type { SeedEntry, SeedOutcome } from "@norish/db/repositories/ingredient-seed";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { IngredientSeedStateSchema, ServerConfigKeys } from "@norish/config/zod/server-config";
import { mergeCatalogueIngredients } from "@norish/db/repositories/ingredient-catalogue";
import {
  applyIngredientSeed,
  flagIngredient,
  listSeededIngredientIds,
  listUnseededSpellings,
} from "@norish/db/repositories/ingredient-seed";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
import { createLogger } from "@norish/shared-server/logger";

import { cleanIngredientText, ingredientAliasFold, stripPreparation } from "../resolver";
import { parseTaxonomy } from "./parse-taxonomy";

const log = createLogger("ingredient-seed");

/** How long one fetch of the taxonomy may take: the file is a few megabytes. */
const FETCH_TIMEOUT_MS = 120_000;

/** The largest file read: a guard against a mirror serving something else entirely. */
const MAX_FILE_BYTES = 64 * 1024 * 1024;

/** A taxonomy file, read and folded into the entries the seed applies. */
export function seedEntriesOf(file: string): SeedEntry[] {
  return parseTaxonomy(file).flatMap((entry) => {
    const name = cleanIngredientText(entry.name);

    if (!name) return [];

    return [
      {
        offId: entry.id,
        name,
        nameFold: ingredientAliasFold(name),
        parentOffId: entry.parentIds[0] ?? null,
        aliases: entry.names.flatMap(({ text, locale }) => {
          const cleaned = cleanIngredientText(text);

          return cleaned ? [{ text: cleaned, fold: ingredientAliasFold(cleaned), locale }] : [];
        }),
      },
    ];
  });
}

/**
 * Apply a taxonomy file: read the whole of it first, then apply it in one
 * transaction. A file that does not read as a taxonomy throws and applies
 * nothing.
 */
export async function applySeedFile(file: string): Promise<{
  entries: SeedEntry[];
  outcome: SeedOutcome;
}> {
  const entries = seedEntriesOf(file);
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
 * The seed's one pass over the Ingredients that existed before it: each one
 * whose spellings (or the same with their preparation stripped) the seed
 * gives to exactly one entry is merged into that entry's Ingredient, as sure
 * as an exact alias match; one whose spellings the seed gives to several is
 * flagged, for a person to sort out. The language model is not asked: this
 * walks an instance's whole history at once.
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

      if ((await mergeCatalogueIngredients(ingredientId, target!)) === "merged") merged += 1;
    } else {
      await flagIngredient(ingredientId);
      flagged += 1;
    }
  }

  log.info({ merged, flagged }, "Existing Ingredients merged into the catalogue seed");

  return { merged, flagged };
}

async function readState(): Promise<IngredientSeedState> {
  return IngredientSeedStateSchema.parse(
    (await getConfig<IngredientSeedState>(ServerConfigKeys.INGREDIENT_SEED_STATE)) ?? {}
  );
}

export type RefreshResult = "disabled" | "unchanged" | "applied";

/**
 * Fetch the taxonomy and apply it where it changed since the last good seed.
 * The request is conditional on the last file's validators, and those are
 * stored only once the file has been applied, so a failed apply is retried
 * in full the next time. The first applied seed is followed by the one pass
 * over the Ingredients that existed before it.
 */
export async function refreshIngredientCatalogue(
  fetchImpl: typeof fetch = fetch
): Promise<RefreshResult> {
  const url = SERVER_CONFIG.INGREDIENT_CATALOGUE_URL;

  if (!url) return "disabled";

  const state = await readState();
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

  const { entries } = await applySeedFile(file);
  const next: IngredientSeedState = {
    ...state,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    appliedAt: new Date().toISOString(),
    entries: entries.length,
  };

  await setConfig(ServerConfigKeys.INGREDIENT_SEED_STATE, next, null, false);

  if (!state.mergedExisting) {
    await mergeExistingIntoSeed(entries);
    await setConfig(
      ServerConfigKeys.INGREDIENT_SEED_STATE,
      { ...next, mergedExisting: true },
      null,
      false
    );
  }

  return "applied";
}
