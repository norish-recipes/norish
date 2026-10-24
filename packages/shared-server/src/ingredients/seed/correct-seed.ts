/**
 * The seed's corrections (`SPELLING_MOVES`), once on an instance seeded before them: a spelling
 * moves with its rows and the own foods its words filed, or comes off and its rows are read again.
 */
import {
  listSeededIngredientIds,
  listUnchosenOwnChildren,
  moveSeededSpelling,
  refileOwnFood,
  takeOffSeededSpelling,
} from "@norish/db/repositories/ingredient-seed";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import { resolveAgain } from "../resolve-again";
import { readName } from "../resolver";
import {
  oncePerVersion,
  readIngredientSeedState,
  SEED_CORRECTIONS_VERSION,
  SPELLING_MOVES,
  updateIngredientSeedState,
} from "./catalogue-seed";

export interface CorrectionOutcome {
  /** Seeded spellings moved to the food the seed now gives them, or taken off where it gives none. */
  moved: number;
  /** Own foods the words filed under the old food, now under the new one. */
  refiled: number;
}

/** Make the corrections where this version of them has not been made; null where it has. */
export async function correctSeedOnce(): Promise<CorrectionOutcome | null> {
  return await oncePerVersion("correctionsVersion", SEED_CORRECTIONS_VERSION, {
    pass: correctSeed,
    changed: (outcome) => outcome.moved + outcome.refiled > 0,
    done: "Seed corrections made",
  });
}

/** Move the spelling to `toId`, or with none take it off and read its rows again; false where gone. */
async function moveOrTakeOff(fold: string, fromId: string, toId: string | null): Promise<boolean> {
  if (toId) return await moveSeededSpelling(fold, fromId, toId);
  const rows = await takeOffSeededSpelling(fold, fromId);

  if (rows) await resolveAgain(rows, "person");

  return rows !== null;
}

async function correctSeed(): Promise<CorrectionOutcome> {
  const seeded = await listSeededIngredientIds();
  const outcome: CorrectionOutcome = { moved: 0, refiled: 0 };

  for (const move of SPELLING_MOVES) {
    const fromId = seeded.get(move.from);
    const toId = move.to === null ? null : seeded.get(move.to);

    // Taken off where the seed gives the spelling no food (null), skipped where that food is unseeded.
    if (!fromId || toId === undefined) continue;
    for (const spelling of move.spellings) {
      if (await moveOrTakeOff(ingredientAliasFold(spelling), fromId, toId)) outcome.moved += 1;
    }
    if (!toId) continue;
    for (const child of await listUnchosenOwnChildren(fromId)) {
      if (
        (await (await readName(child.name)).parent()) === toId &&
        (await refileOwnFood(child.id, fromId, toId))
      ) {
        outcome.refiled += 1;
      }
    }
  }

  // The seed re-stamps a kept spelling's language as it applies a file: the nightly refresh,
  // its validators forgotten, applies the file again. The boot downloads nothing.
  if ((await readIngredientSeedState()).appliedAt) {
    await updateIngredientSeedState({ etag: null, lastModified: null });
  }

  return outcome;
}
