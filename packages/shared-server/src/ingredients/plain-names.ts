/**
 * Plain Names (CONTEXT.md): AI renames a food to its plain name as an AI Change, or merges it into
 * the food already spelling that name; a settled name is never asked about again.
 */
import type { ReviewTrace, ReviewVerdict } from "@norish/shared/contracts/ingredient-catalogue";
import {
  findCatalogueIngredient,
  listCatalogueAliasesOf,
  settleIngredientName,
} from "@norish/db/repositories/ingredient-catalogue";
import { createLogger } from "@norish/shared-server/logger";
import { noTrace } from "@norish/shared/contracts/ingredient-catalogue";
import { foldName } from "@norish/shared/lib/fold-name";

import { readPlainName } from "../ai/resolution/plain-name";
import { isOverriding, mergeByAI, renameByAI, skippedBy } from "./ai-changes";
import { ingredientChanges } from "./changes";
import { cleanIngredientText, findFood, isExact } from "./resolver";

const log = createLogger("ingredients");

/** What asking for one food's Plain Name came to, or why the food was passed over. */
export type PlainNameOutcome =
  | Extract<ReviewVerdict, { outcome: "rename" }>
  | { outcome: "plain" }
  | ({ outcome: "merge"; into: string; sure: true } & ReviewTrace)
  | ({ outcome: "unsure"; reason: "no-food" } & ReviewTrace)
  | { outcome: "skipped"; reason: "settled" | "decided" | "undone" | "not-found" };

/** Ask for a food's Plain Name and make it; throws what the question throws. */
export async function giveItsPlainName(ingredientId: string): Promise<PlainNameOutcome> {
  const row = await findCatalogueIngredient(ingredientId);

  if (!row) return { outcome: "skipped", reason: "not-found" };
  if (!isOverriding()) {
    if (row.nameSettled) return { outcome: "skipped", reason: "settled" };
    if (!row.askable) return { outcome: "skipped", reason: "decided" };
  }

  const spellings = await listCatalogueAliasesOf(ingredientId);
  const read = await readPlainName(
    row.name,
    spellings.map((spelling) => spelling.text)
  );
  const plain = read ? cleanIngredientText(read) : "";

  if (!plain) return { outcome: "unsure", reason: "no-food", ...noTrace() };
  // Folded as spellings are: a case-only difference keeps the casing, but not of a name in capitals.
  const settled = /\p{Ll}/u.test(row.name)
    ? foldName(plain) === foldName(row.name)
    : plain === row.name;

  if (settled) {
    if (await settleIngredientName(ingredientId)) await ingredientChanges().changed([ingredientId]);

    return { outcome: "plain" };
  }

  // Looked up as AI's names are; the name itself finding a food makes it that food, parent or not.
  const [found] = await findFood([plain], { except: ingredientId, among: "listed" });
  const holder = found?.find(isExact);

  if (holder) {
    const merged = await mergeByAI(ingredientId, holder.ingredientId, true);

    if (merged === "applied") {
      const into = (await findCatalogueIngredient(holder.ingredientId))?.name ?? plain;

      return { outcome: "merge", into, sure: true, ...noTrace() };
    }

    return skippedBy(merged);
  }
  const renamed = await renameByAI(ingredientId, row.name, plain);

  return renamed === "applied" ? { outcome: "rename", to: plain } : skippedBy(renamed);
}

/** The Plain Name step after AI's answer: the rename or merge, or null; a broken question changes nothing. */
export async function nameAfterAnswer(
  ingredientId: string
): Promise<Extract<PlainNameOutcome, { outcome: "rename" | "merge" }> | null> {
  const named = await giveItsPlainName(ingredientId).catch((error: unknown) => {
    log.warn({ err: error, ingredientId }, "Asking a food's Plain Name failed");

    return null;
  });

  return named?.outcome === "rename" || named?.outcome === "merge" ? named : null;
}
