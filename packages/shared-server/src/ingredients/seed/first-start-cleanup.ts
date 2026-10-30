/**
 * The first start's cleanup of what earlier versions left (ADR-0037; ingredient-cleanup ticket 09),
 * once per `CLEANUP_VERSION`: each step's function says what it does.
 */
import type { DbTransaction } from "@norish/db/drizzle";
import type { CleanupSpelling } from "@norish/db/repositories/ingredient-cleanup";
import type { LineJoin } from "@norish/shared/lib/line-foods";
import { withTransaction } from "@norish/db/drizzle";
import { clearRetiredFlags } from "@norish/db/repositories/ingredient-ai-changes";
import {
  deleteCatalogueAlias,
  deleteCatalogueIngredient,
  deleteUnnamedOwnFoods,
  findCatalogueAliasOwner,
  findIngredientIdByFold,
  unflagHiddenFoods,
  unmarkChosenParents,
} from "@norish/db/repositories/ingredient-catalogue";
import {
  findLinesNamingAFood,
  findRowsNamingSpellings,
  listOwnFoods,
  listSpellingsForCleanup,
  renameFood,
  rewriteSpelling,
} from "@norish/db/repositories/ingredient-cleanup";
import {
  countAliasesOf,
  lockFoods,
  lockTree,
  mergeCatalogueIngredients,
  splitCatalogueIngredient,
} from "@norish/db/repositories/ingredient-relocation";
import { lineNamesNoFood } from "@norish/shared/lib/ingredient-text";
import { ingredientAliasFold, withoutStrayMarks } from "@norish/shared/lib/spelling-keys";

import type { ResolvedIngredient } from "../resolver";
import { resolveAgain } from "../resolve-again";
import { findFoodBeforeNote, readName } from "../resolver";
import { oncePerVersion } from "./catalogue-seed";

/** Raised when a release needs the cleanup to run again. */
export const CLEANUP_VERSION = 9;

/** How many variants one round removes; each round commits, so a boot cut short resumes. */
// ponytail: ~2 ms a variant, ~2.5 min for production's 71k; set-based if ticket 12 finds it slow.
const REMOVED_PER_ROUND = 200;

/** How many lines a round of the read-again step resolves and writes in one transaction. */
const REREAD_PER_ROUND = 500;

export interface CleanupOutcome {
  /** Seeded spellings whose stray marks went (1). */
  seeded: number;
  /** Own spellings given their clean text in place (2, and 3 where the clean name was free). */
  cleaned: number;
  /** Own spellings removed, their rows resolved again (3, and 2's that name no food). */
  removed: number;
  /** Lines naming no food by their own text that lost the food they named (4). */
  cleared: number;
  /** Joined foods split and removed (5). */
  split: number;
  /** Own foods given the clean name their name reduces to (5). */
  renamed: number;
  /** Hidden foods whose flag went (6). */
  unflagged: number;
  /** Own foods whose parent no longer counts as a person's choice (7). */
  unmarked: number;
  /** Foods whose flag said AI was waiting, off or failing, which is no flag now (8). */
  retired: number;
  /** Lines naming a food that read other foods under today's rules, and were pointed there (9). */
  reread: number;
  /** Own foods no row named once the lines were read again (10). */
  deleted: number;
}

/** An own spelling that is not its own clean name. */
interface Variant extends CleanupSpelling {
  clean: { text: string; fold: string };
}

/** Run the cleanup where this release's version of it has not run yet; null where it has. */
export async function cleanUpCatalogueOnFirstStart(): Promise<CleanupOutcome | null> {
  return await oncePerVersion("cleanupVersion", CLEANUP_VERSION, {
    pass: cleanUpCatalogue,
    // Every step changes which food rows mean, or a food's flag.
    changed: (steps) => Object.values(steps).some((n) => n > 0),
    done: "Catalogue cleaned up",
  });
}

async function cleanUpCatalogue(from: number): Promise<CleanupOutcome> {
  // 1. Seeded spellings lose their stray marks ("3wu)"); balanced brackets stay ("paprika (vrucht)").
  const outcome: CleanupOutcome = {
    seeded: 0,
    cleaned: 0,
    removed: 0,
    cleared: 0,
    split: 0,
    renamed: 0,
    unflagged: 0,
    unmarked: 0,
    retired: 0,
    reread: 0,
    deleted: 0,
  };
  // 7, first. 0.25 marked a confirmed suggestion as a person's parent, so its marks go on an
  // instance's first cleanup, after this boot's passes that file only unmarked foods; the steps
  // below then read those foods as undecided.
  if (from === 0) outcome.unmarked = await underTreeLock(unmarkChosenParents);

  const spellings = await listSpellingsForCleanup();
  const variants: Variant[] = [];

  for (const spelling of spellings) {
    if (spelling.seeded) {
      const text = withoutStrayMarks(spelling.text);

      if (text && text !== spelling.text) {
        if (await rewriteSpelling(spelling.id, { text, fold: ingredientAliasFold(text) })) {
          outcome.seeded += 1;
        }
      }
      continue;
    }

    const { clean } = await readName(spelling.text);

    if (clean.text !== spelling.text || clean.fold !== spelling.fold) {
      variants.push({ ...spelling, clean });
      continue;
    }
    // An own food's spelling read up to its note ("olie om te bakken") is that known food's,
    // kept distinct or named, unless a person chose its parent.
    const noted = spelling.cleanable ? await findFoodBeforeNote(spelling.text) : null;

    if (noted && noted.ingredientId !== spelling.ingredientId) {
      variants.push({ ...spelling, clean: { text: noted.text, fold: noted.fold } });
    }
  }

  // 2 and 3. An own spelling takes its clean name where free, dirty ones first; the rest, and any
  // a line names no food by ("Voor de salade:"), go; their rows resolve again (`removeVariants`).
  const removing: Variant[] = [];

  for (const variant of [...variants].sort(
    (a, b) => Number(b.fold === b.clean.fold) - Number(a.fold === a.clean.fold)
  )) {
    if (
      variant.clean.fold &&
      !lineNamesNoFood({ text: variant.text }) &&
      (await rewriteSpelling(variant.id, variant.clean))
    ) {
      outcome.cleaned += 1;
    } else {
      removing.push(variant);
    }
  }
  for (let start = 0; start < removing.length; start += REMOVED_PER_ROUND) {
    outcome.removed += await removeVariants(removing.slice(start, start + REMOVED_PER_ROUND));
  }

  // 4. A line whose own text names no food loses the food it names, as a new import gives it none
  // ("Peri peri kruiden:" on the clean "peri peri kruiden"); a food nothing names is the sweep's.
  const cleared = (await findLinesNamingAFood()).filter((line) =>
    lineNamesNoFood({ text: line.name ?? "", amount: line.amount })
  );

  await resolveAgain({ lines: cleared, groceries: [], recurring: [] }, "repoint");
  outcome.cleared = cleared.length;

  // 5. An own food whose name is joined ("zout en peper") is split, even one kept distinct; a mix
  // holding a joined spelling stays. Any other takes the clean name its name reduces to.
  for (const food of await listOwnFoods()) {
    const read = await readName(food.name);
    const split = await read.parts(food.id);

    if (split) {
      if (await splitFood(food.id, split.parts, split.joined)) outcome.split += 1;
      continue;
    }
    const { clean } = read;

    if (clean.fold && clean.text !== food.name && (await renameFood(food.id, clean.text))) {
      outcome.renamed += 1;
    }
  }

  // 6. A hidden food has no flag (`unflagHiddenFoods`).
  outcome.unflagged = await underTreeLock(unflagHiddenFoods);

  // 8. A flag says only that AI changed a food unsure (`clearRetiredFlags`).
  outcome.retired = await underTreeLock(clearRetiredFlags);

  // 9. Every line naming a food is read again under today's rules (a comma list, a slash, junk), as
  // an import would read it now; placed spellings are read first, and a seeded food stays.
  const lines = await findLinesNamingAFood();
  const listed = await listOwnFoods();

  for (let start = 0; start < lines.length; start += REREAD_PER_ROUND) {
    outcome.reread += await resolveAgain(
      { lines: lines.slice(start, start + REREAD_PER_ROUND), groceries: [], recurring: [] },
      "upgrade",
      { refine: true }
    );
  }

  // 10. An own food the lines no longer name goes ("melted"), unless something else names it.
  outcome.deleted = await underTreeLock((tx) =>
    deleteUnnamedOwnFoods(
      tx,
      listed.map((food) => food.id)
    )
  );

  return outcome;
}

/** One write under the tree lock, taken first as every catalogue write takes it. */
async function underTreeLock(write: (tx: DbTransaction) => Promise<number>): Promise<number> {
  return await withTransaction(async (tx) => {
    await lockTree(tx);

    return await write(tx);
  });
}

/**
 * Remove these spellings and resolve their rows again, AI off; a food left with none joins the food
 * holding its clean name, or goes where that names nothing (")"). Answers how many went.
 */
async function removeVariants(variants: readonly Variant[]): Promise<number> {
  let removed = 0;
  const named = await withTransaction(async (tx) => {
    await lockTree(tx);
    const rows = await findRowsNamingSpellings(
      tx,
      variants.map((variant) => variant.id)
    );

    for (const variant of variants) {
      const spelling = await findCatalogueAliasOwner(tx, variant.id);

      if (!spelling) continue;
      if ((await countAliasesOf(tx, spelling.ingredientId)) <= 1) {
        const target = variant.clean.fold
          ? await findIngredientIdByFold(tx, variant.clean.fold)
          : null;

        // A colon spelling's fold may be its clean one, so the food holding it is its own.
        if (!target || target === spelling.ingredientId) {
          await deleteCatalogueIngredient(tx, spelling.ingredientId);
          removed += 1;
          continue;
        }
        await mergeCatalogueIngredients(tx, spelling.ingredientId, target, { keepFlag: true });
      }
      await deleteCatalogueAlias(tx, variant.id);
      removed += 1;
    }

    return rows;
  });

  await resolveAgain(named, "upgrade");

  return removed;
}

/** Split a joined food into the foods its name joins, and remove it; false where one went meanwhile. */
async function splitFood(
  ingredientId: string,
  parts: readonly ResolvedIngredient[],
  joined: LineJoin
): Promise<boolean> {
  const [first, ...rest] = parts;

  if (!first) return false;
  const ids = [ingredientId, ...parts.map((part) => part.ingredientId)];

  return await withTransaction(async (tx) => {
    if (!(await lockFoods(tx, ids))) return false;
    await splitCatalogueIngredient(tx, ingredientId, [first, ...rest], joined);

    return true;
  });
}
