/**
 * Once per `RUNG_VERSION`, the resolver reads each undecided mint again, oldest first: merged where
 * it names one other food, left where several, else given today's plain name and its words' parent.
 */
import { withTransaction } from "@norish/db/drizzle";
import { mergeCatalogueIngredients } from "@norish/db/repositories/ingredient-relocation";
import {
  adoptPlainName,
  fileUndecidedMint,
  listUndecidedMints,
} from "@norish/db/repositories/ingredient-seed";

import { findOtherFoodsSpelled, readName, RUNG_VERSION } from "../resolver";
import { oncePerVersion } from "./catalogue-seed";

export interface RecheckOutcome {
  merged: number;
  filed: number;
}

/** Look at every undecided mint again under the current rules. */
export async function recheckUndecidedMints(): Promise<RecheckOutcome> {
  const outcome: RecheckOutcome = { merged: 0, filed: 0 };

  for (const mint of await listUndecidedMints()) {
    const targets = await findOtherFoodsSpelled(mint.id, mint.aliases);

    if (targets.size === 1) {
      const [target] = targets;

      // Into a seeded food, or into an earlier undecided mint: that one keeps its flag.
      if (
        await withTransaction((tx) =>
          mergeCatalogueIngredients(tx, mint.id, target!, { keepFlag: true })
        )
      ) {
        outcome.merged += 1;
      }
      continue;
    }
    if (targets.size > 1) continue;

    const read = await readName(mint.name);

    if (read.plain) await adoptPlainName(mint.id, read.plain);
    // A parent AI gave or took is AI's to change.
    if (mint.answered || mint.parentId !== null) continue;

    const parentId = await read.parent(mint.id);

    if (parentId && (await fileUndecidedMint(mint.id, parentId))) outcome.filed += 1;
  }

  return outcome;
}

/**
 * The pass, where the resolver's rules changed since it last ran; the rung version is recorded only
 * once it is through, so a failure retries in full at the next boot.
 */
export async function recheckUndecidedMintsOnRungChange(): Promise<RecheckOutcome | null> {
  return await oncePerVersion("rungVersion", RUNG_VERSION, {
    pass: recheckUndecidedMints,
    // Merges and parents change which food lines mean.
    changed: (outcome) => outcome.merged > 0 || outcome.filed > 0,
    done: "Undecided mints looked at again",
  });
}
