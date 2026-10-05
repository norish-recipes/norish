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
export function reviewMessage(
  t: Translate,
  name: string,
  outcome: ReviewOutcome | Exclude<ReviewReportEntry, { outcome: "skipped" | "failed" }>
): string {
  switch (outcome.outcome) {
    case "merge":
      return t("aiOutcomes.merge", { name, into: outcome.into });
    case "parent":
      return t("aiOutcomes.parent", { name, of: outcome.of });
    case "distinct":
      return t("aiOutcomes.distinct", { name });
    case "unsure":
      return t("aiOutcomes.unsure", { name });
    case "not-flagged":
      return t("aiOutcomes.notFlagged", { name });
  }
}

/**
 * One food of a round's report, in the viewer's words: what AI suggested
 * for it, and how it got there where it was asked at all.
 */
export function reportEntryCopy(
  t: Translate,
  entry: ReviewReportEntry
): { message: string; detail: string | null } {
  const name = entry.name ?? entry.ingredientId;

  switch (entry.outcome) {
    case "skipped":
      return {
        message:
          entry.reason === "not-flagged"
            ? t("aiOutcomes.skippedNotFlagged", { name })
            : entry.reason === "forbidden"
              ? t("aiOutcomes.skippedForbidden", { name })
              : t("aiOutcomes.skippedNotFound", { name }),
        detail: null,
      };
    case "failed":
      return { message: t("aiOutcomes.failed", { name }), detail: entry.error };
    default:
      return { message: reviewMessage(t, name, entry), detail: reviewTrace(t, entry) };
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
  }
}

/** Why a round passed a food over, without the food's name. */
export function skippedReason(
  t: Translate,
  reason: "not-flagged" | "forbidden" | "not-found"
): string {
  switch (reason) {
    case "not-flagged":
      return t("skippedReasons.notFlagged");
    case "forbidden":
      return t("skippedReasons.forbidden");
    case "not-found":
      return t("skippedReasons.notFound");
  }
}

/**
 * How a suggestion came about: what AI tried, or that the words of the name
 * alone gave it.
 */
export function suggestionTrace(t: Translate, suggestion: IngredientSuggestion): string {
  return suggestion.source === "words" ? t("aiTrace.fromWords") : reviewTrace(t, suggestion);
}
