/**
 * The AI pass over a food (ADR-0037): AI reads its name, the code looks the reading up, and the
 * answer is made as an AI Change. The review queue runs it.
 */
import type {
  FlagReason,
  ReviewOutcome,
  ReviewTrace,
} from "@norish/shared/contracts/ingredient-catalogue";
import { wasParentSetByAI } from "@norish/db/repositories/ingredient-ai-changes";
import {
  findCatalogueIngredient,
  listSpellingHouseholds,
  setIngredientFlagReason,
} from "@norish/db/repositories/ingredient-catalogue";
import { noTrace } from "@norish/shared/contracts/ingredient-catalogue";
import { distinctFoods } from "@norish/shared/lib/line-foods";

import type { AIResolution } from "../ai/resolution/ingredient-resolution";
import type { SpellingCheckOutcome } from "./spelling-check";
import { askWhatFoodThisIs, findFoodNamed } from "../ai/resolution/ingredient-resolution";
import {
  deleteByAI,
  flagByAnswer,
  isOverriding,
  mergeByAI,
  overridingDecisions,
  parentByAI,
  skippedBy,
  splitByAI,
} from "./ai-changes";
import { ingredientChanges } from "./changes";
import { announcingAfter } from "./minted";
import { nameAfterAnswer } from "./plain-names";
import { resolveParts } from "./resolver";
import { checkSpellingsOf } from "./spelling-check";

export type { ReviewOutcome };

/** What a Clean up came to for a food: AI's answer, and for a seeded food its spellings' check. */
export type CleanUpOutcome = ReviewOutcome & { spellings?: SpellingCheckOutcome };

/**
 * A whole-catalogue Clean up of one food (CONTEXT.md), overriding a person's decisions and undos.
 * A seeded food is the catalogue's own: only the spellings households added to it are checked, each
 * household's inside its own catalogue.
 */
export async function cleanUpOverWholeCatalogue(ingredientId: string): Promise<CleanUpOutcome> {
  return await overridingDecisions(async () => {
    if (!(await findCatalogueIngredient(ingredientId))?.seeded)
      return await askAIAbout(ingredientId);
    const checks: SpellingCheckOutcome[] = [];

    for (const householdId of await listSpellingHouseholds(ingredientId)) {
      checks.push(await checkSpellingsOf(householdId, ingredientId));
    }

    return {
      outcome: "skipped",
      reason: "seeded",
      ...noTrace(),
      spellings: togetherChecked(checks),
    };
  });
}

/** Several households' spelling checks of one food as one. */
function togetherChecked(checks: readonly SpellingCheckOutcome[]): SpellingCheckOutcome {
  const checked = checks.flatMap((check) => (check.outcome === "checked" ? [check] : []));

  if (checked.length === 0) return checks[0] ?? { outcome: "skipped", reason: "none" };

  return {
    outcome: "checked",
    kept: checked.flatMap((check) => check.kept),
    removed: checked.flatMap((check) => check.removed),
    moved: checked.flatMap((check) => check.moved),
    unchanged: checked.flatMap((check) => check.unchanged),
  };
}

/** Ask AI what a food is and make the answer; a food not merged away then gets its Plain Name. */
export async function askAIAbout(ingredientId: string): Promise<ReviewOutcome> {
  const row = await findCatalogueIngredient(ingredientId);
  const trace = noTrace();

  if (!row) return { outcome: "skipped", reason: "not-found", ...trace };
  if (!row.askable && !isOverriding()) return { outcome: "skipped", reason: "decided", ...trace };
  // AI asks inside the food's household and the seed; a seeded food is never asked about.
  if (!row.householdId) return { outcome: "skipped", reason: "seeded", ...trace };
  const { householdId } = row;

  const current = row.parentId ? await findCatalogueIngredient(row.parentId) : null;
  const filedUnder = current && {
    ...current,
    byAI: await wasParentSetByAI(ingredientId, current.id),
  };
  const answer = await askWhatFoodThisIs(row.name, {
    householdId,
    excludeId: ingredientId,
    filedUnder,
    trace,
  });

  if (answer.kind === "same") {
    const into = await findCatalogueIngredient(answer.ingredientId);
    const applied = into ? await mergeByAI(ingredientId, into.id, answer.sure) : "gone";

    if (!into || applied === "gone") return await foodGone(ingredientId, trace);
    if (applied !== "applied") return { ...skippedBy(applied), ...trace };

    return { outcome: "merge", into: into.name, sure: answer.sure, ...trace };
  }
  // A seeded food is never deleted, so it is neither split nor taken for not a food.
  if (row.seeded && (answer.kind === "several" || answer.kind === "not-a-food")) {
    return { outcome: "skipped", reason: "seeded", ...trace };
  }
  if (answer.kind === "several") {
    return await announcingAfter(() => split({ ...row, householdId }, answer, trace));
  }
  if (answer.kind === "not-a-food") {
    // A tool goes unsure too (Mike, ticket 08); an unsure "names nothing" is only flagged.
    return answer.sure || answer.tool
      ? await deleted(ingredientId, trace)
      : await doubted(ingredientId, "ai-junk", trace);
  }
  // No answer leaves the food unreviewed, not flagged.
  if (answer.kind === "unanswered")
    return { outcome: "unanswered", reason: answer.reason, ...trace };

  const { sure } = answer;
  // A parent merged away while AI read is found again by its name: the merge moved its spellings.
  const parent =
    answer.parent &&
    ((await findCatalogueIngredient(answer.parent.id)) ??
      (await foundAgain(householdId, answer.parent.name, ingredientId)));
  // No parent from AI drops the current one, but never a seeded food's; a person's is never asked.
  const { outcome: filed, previous } =
    parent || (row.parentId && !row.seeded)
      ? await parentByAI(ingredientId, parent?.id ?? null, sure)
      : { outcome: null, previous: null };
  const dropped =
    !parent && filed === "applied" && previous ? await findCatalogueIngredient(previous) : null;

  if (filed === "decided") return { outcome: "skipped", reason: "decided", ...trace };
  if (filed !== "applied") await flagByAnswer(ingredientId, sure);
  if (filed === "undone") return { outcome: "skipped", reason: "undone", ...trace };

  const named =
    row.seeded || (row.nameSettled && !isOverriding()) ? null : await nameAfterAnswer(ingredientId);

  if (named) return { ...trace, ...named };
  if (filed && filed !== "applied") return { ...skippedBy(filed), ...trace };
  if (parent && filed === "applied") return { outcome: "parent", of: parent.name, sure, ...trace };
  if (dropped) return { outcome: "no-parent", from: dropped.name, sure, ...trace };

  return sure
    ? { outcome: "distinct", ...trace }
    : { outcome: "unsure", reason: "ai-unsure", ...trace };
}

async function foundAgain(householdId: string, name: string, excludeId: string) {
  const named = await findFoodNamed(householdId, name, excludeId);

  return named.kind === "found" ? await findCatalogueIngredient(named.food.ingredientId) : null;
}

/**
 * Several foods: a part AI found or picked is that food, the others rungs 1-2 or a mint (no slip),
 * and the food's rows name them instead; a part spelled by the food moves to the food named for it.
 */
async function split(
  food: { id: string; householdId: string; ownerId: string | null },
  answer: Extract<AIResolution, { kind: "several" }>,
  trace: ReviewTrace
): Promise<ReviewOutcome> {
  if (!answer.sure) return await doubted(food.id, "ai-unsure", trace);
  // A person may have decided about the food while AI was asked: mint no parts for nothing.
  const now = await findCatalogueIngredient(food.id);

  if (!now) return { outcome: "skipped", reason: "not-found", ...trace };
  if (!now.askable && !isOverriding()) return { outcome: "skipped", reason: "decided", ...trace };

  const read = await resolveParts(
    answer.parts.map((part) => (part.found ? { ...part.found, text: part.text } : part.text)),
    { householdId: food.householdId, userId: food.ownerId },
    "split"
  );
  const parts = distinctFoods(read);
  const [first, ...rest] = parts;

  // Two parts spelled by the food itself would fold into one: which spelling is which is unknown.
  if (!first || read.filter((part) => part.ingredientId === food.id).length > 1) {
    return await doubted(food.id, "ai-unsure", trace);
  }

  const applied = await splitByAI(food.id, [first, ...rest], answer.joined);

  if (applied === "refused") return await doubted(food.id, "ai-unsure", trace);
  if (applied !== "applied") return { ...skippedBy(applied), ...trace };

  return { outcome: "split", into: parts.map((part) => part.text), ...trace };
}

/** Not a food: the food goes, and its rows keep their text. */
async function deleted(ingredientId: string, trace: ReviewTrace): Promise<ReviewOutcome> {
  const outcome = await deleteByAI(ingredientId);

  if (outcome === "kept") return { outcome: "unsure", reason: "ai-junk", ...trace };
  if (outcome === "applied") return { outcome: "not-a-food", ...trace };

  return { ...skippedBy(outcome), ...trace };
}

/** An answer AI was not sure of that would change too much to make: the food is flagged with it. */
async function doubted(
  ingredientId: string,
  reason: FlagReason,
  trace: ReviewTrace
): Promise<ReviewOutcome> {
  await flagByAnswer(ingredientId, false, reason);

  return { outcome: "unsure", reason, ...trace };
}

/** The food AI named was merged away meanwhile: the food stays as it was, and its flag says so. */
async function foodGone(ingredientId: string, trace: ReviewTrace): Promise<ReviewOutcome> {
  await setIngredientFlagReason(ingredientId, "food-gone");
  const householdId = (await findCatalogueIngredient(ingredientId))?.householdId;

  if (householdId) await ingredientChanges().changed([ingredientId], householdId);

  return { outcome: "unsure", reason: "food-gone", ...trace };
}
