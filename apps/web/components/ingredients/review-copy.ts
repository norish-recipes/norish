import type { useTranslations } from "next-intl";

import type {
  ReviewOutcome,
  ReviewReportEntry,
} from "@norish/shared/contracts/ingredient-catalogue";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import type { IngredientSuggestion } from "./use-ingredient-suggestions";

type Translate = ReturnType<typeof useTranslations<"settings.ingredients">>;

/** What AI tried, so the viewer can judge its answer: what it read the name as, and what it compared it with. */
export function reviewTrace(
  t: Translate,
  outcome: Pick<ReviewOutcome, "considered" | "englishName">
): string {
  const considered =
    outcome.considered.length > 0
      ? t("aiTrace.compared", { names: outcome.considered.slice(0, 8).join(", ") })
      : t("aiTrace.comparedNothing");

  return outcome.englishName
    ? `${t("aiTrace.readAs", { name: outcome.englishName })} ${considered}`
    : considered;
}

/** What to tell the viewer about an AI review, in their words: what it now suggests. */
export function reviewMessage(t: Translate, name: string, outcome: ReviewOutcome): string {
  switch (outcome.outcome) {
    case "merge":
      return t("aiOutcomes.merge", { name, into: outcome.into });
    case "parent":
      return t("aiOutcomes.parent", { name, of: outcome.of });
    case "distinct":
      return t("aiOutcomes.distinct", { name });
    case "unsure":
      // A refused key is no doubt about the food: say what actually stopped AI.
      return outcome.reason === "ai-key-rejected"
        ? t("flagReasons.ai-key-rejected")
        : t("aiOutcomes.unsure", { name });
    case "not-flagged":
      return t("aiOutcomes.notFlagged", { name });
  }
}

/** What a suggestion proposes, in the viewer's words and language. */
export function suggestionMessage(
  t: Translate,
  suggestion: IngredientSuggestion,
  locale: string
): string {
  const name = ingredientDisplayName(suggestion.ingredient, locale);
  const target = suggestion.target ? ingredientDisplayName(suggestion.target, locale) : "";

  switch (suggestion.kind) {
    case "merge":
      return t("suggestion.merge", { name, into: target });
    case "parent":
      return suggestion.source === "words"
        ? t("suggestion.filedFromName", { name, of: target })
        : t("suggestion.parent", { name, of: target });
    case "distinct":
      return t("suggestion.distinct", { name });
    case "rename":
      return t("suggestion.rename", { name, to: suggestion.proposedName ?? "" });
  }
}

/** What a suggestion proposes, without the food's name: the proposal column of the table. */
export function suggestionProposal(
  t: Translate,
  suggestion: IngredientSuggestion,
  locale: string
): string {
  const target = suggestion.target ? ingredientDisplayName(suggestion.target, locale) : "";

  switch (suggestion.kind) {
    case "merge":
      return t("proposal.merge", { into: target });
    case "parent":
      return t("proposal.parent", { of: target });
    case "distinct":
      return t("proposal.distinct");
    case "rename":
      return t("proposal.rename", { to: suggestion.proposedName ?? "" });
  }
}

/** Why a round passed a food over, without the food's name. */
export function skippedReason(
  t: Translate,
  reason: Extract<ReviewReportEntry, { outcome: "skipped" }>["reason"]
): string {
  switch (reason) {
    case "settled":
      return t("skippedReasons.settled");
    case "not-flagged":
      return t("skippedReasons.notFlagged");
    case "forbidden":
      return t("skippedReasons.forbidden");
    case "not-found":
      return t("skippedReasons.notFound");
  }
}

/**
 * How a suggestion came about: what AI tried, what it read the name as when
 * asked for its Plain Name, or that the words of the name alone gave it.
 */
export function suggestionTrace(t: Translate, suggestion: IngredientSuggestion): string {
  if (suggestion.source === "words") return t("aiTrace.fromWords");
  if (suggestion.proposedName) return t("aiTrace.readAs", { name: suggestion.proposedName });

  return reviewTrace(t, suggestion);
}
