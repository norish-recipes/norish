"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import Panel from "@/components/Panel/Panel";
import { Button, Chip, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import type { ReviewReportEntry } from "@norish/shared/contracts/ingredient-catalogue";

import type { IngredientSuggestion } from "./use-ingredient-suggestions";
import { reportEntryCopy, reviewTrace, suggestionMessage } from "./review-copy";
import { useIngredientSuggestions } from "./use-ingredient-suggestions";

/** The foods a round asked about that got no suggestion, and so are worth a word. */
const UNSUGGESTED: ReadonlySet<ReviewReportEntry["outcome"]> = new Set([
  "unsure",
  "skipped",
  "failed",
]);

const UNSUGGESTED_COLOR: Record<string, "warning" | "default" | "danger"> = {
  unsure: "warning",
  skipped: "default",
  failed: "danger",
};

/**
 * What AI suggests for the catalogue, waiting on a person: one line per
 * food, what AI proposes and how it got there, each confirmed or dismissed on
 * its own, or all at once. Confirming makes the edit as the viewer's own.
 * Opened on its own when a round of Ask AI the viewer started ends, and from the page while
 * anything is waiting. Where this tab saw a round end, the foods it got no
 * suggestion for follow, with why: AI was not sure, the food was passed
 * over, or its question broke.
 */
export function SuggestionsPanel({
  jobId,
  open,
  onClose,
}: {
  jobId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("settings.ingredients");
  const locale = useLocale();
  const trpc = useTRPC();
  const { suggestions, isAnswering, confirm, dismiss } = useIngredientSuggestions();
  const report = useQuery({
    ...trpc.ingredients.reviewReport.queryOptions({ jobId: jobId ?? "" }),
    enabled: open && jobId !== null,
  });
  const answerable = suggestions.filter((suggestion) => suggestion.canAnswer);
  const unsuggested = (report.data?.entries ?? []).filter((entry) =>
    UNSUGGESTED.has(entry.outcome)
  );

  const row = (suggestion: IngredientSuggestion) => (
    <li
      key={suggestion.id}
      className="border-border flex flex-col gap-2 rounded-lg border p-3"
      data-kind={suggestion.kind}
      data-testid="ingredient-suggestion"
    >
      <span className="text-sm font-medium">{suggestionMessage(t, suggestion, locale)}</span>
      <p className="text-muted text-sm">{reviewTrace(t, suggestion)}</p>
      {suggestion.canAnswer ? (
        <div className="flex justify-end gap-2">
          <Button
            data-testid="ingredient-suggestion-dismiss"
            isDisabled={isAnswering}
            size="sm"
            variant="ghost"
            onPress={() => void dismiss([suggestion.id])}
          >
            {t("dismissSuggestion")}
          </Button>
          <Button
            data-testid="ingredient-suggestion-confirm"
            isDisabled={isAnswering}
            size="sm"
            variant="secondary"
            onPress={() => void confirm([suggestion.id])}
          >
            {t("confirmSuggestion")}
          </Button>
        </div>
      ) : null}
    </li>
  );

  return (
    <Panel
      open={open}
      title={t("suggestionsTitle")}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Panel.Body>
        <div className="flex flex-col gap-4" data-testid="ingredients-suggestions">
          {report.data && !report.data.finished ? (
            <p className="text-muted text-sm">{t("reportRunning")}</p>
          ) : null}
          {suggestions.length === 0 ? (
            <p className="text-muted text-sm">{t("suggestionsEmpty")}</p>
          ) : (
            <ol className="flex flex-col gap-3">{suggestions.map(row)}</ol>
          )}
          {report.isFetching && !report.data ? (
            <div className="flex justify-center py-2">
              <Spinner color="accent" size="sm" />
            </div>
          ) : null}
          {unsuggested.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
                {t("suggestionsNone")}
              </h3>
              <ol className="flex flex-col gap-3">
                {unsuggested.map((entry, index) => {
                  const { message, detail } = reportEntryCopy(t, entry);

                  return (
                    <li
                      key={`${entry.ingredientId}-${index}`}
                      className="border-border flex flex-col gap-1 rounded-lg border p-3"
                      data-outcome={entry.outcome}
                      data-testid="ingredients-review-entry"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{message}</span>
                        <Chip color={UNSUGGESTED_COLOR[entry.outcome]} size="sm" variant="soft">
                          {t(`reportOutcomes.${entry.outcome}`)}
                        </Chip>
                      </div>
                      {detail ? <p className="text-muted text-sm">{detail}</p> : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </div>
      </Panel.Body>
      {answerable.length > 0 ? (
        <Panel.Footer>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              data-testid="ingredient-suggestions-dismiss-all"
              isDisabled={isAnswering}
              variant="ghost"
              onPress={() => void dismiss(answerable.map((suggestion) => suggestion.id))}
            >
              {t("dismissAll")}
            </Button>
            <Button
              data-testid="ingredient-suggestions-confirm-all"
              isDisabled={isAnswering}
              isPending={isAnswering}
              variant="primary"
              onPress={() => void confirm(answerable.map((suggestion) => suggestion.id))}
            >
              {t("confirmAll", { count: answerable.length })}
            </Button>
          </div>
        </Panel.Footer>
      ) : null}
    </Panel>
  );
}
