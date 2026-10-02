"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import Panel from "@/components/Panel/Panel";
import DataTable from "@/components/ui/data-table";
import { Button, Chip, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import type { ReviewReportEntry } from "@norish/shared/contracts/ingredient-catalogue";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import type { IngredientSuggestion } from "./use-ingredient-suggestions";
import { reviewTrace, skippedReason, suggestionProposal, suggestionTrace } from "./review-copy";
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

/** One food a round got no suggestion for, as the report table lists it. */
type Unsuggested = Extract<ReviewReportEntry, { outcome: "unsure" | "skipped" | "failed" }>;

/**
 * What AI suggests for the catalogue, waiting on a person: one table row per
 * food, what is proposed and on what basis, each confirmed or dismissed on
 * its own, or all at once; an answered row leaves the table at once.
 * Confirming makes the edit as the viewer's own.
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
  const { suggestions, confirm, dismiss } = useIngredientSuggestions();
  const report = useQuery({
    ...trpc.ingredients.reviewReport.queryOptions({ jobId: jobId ?? "" }),
    enabled: open && jobId !== null,
  });
  const answerable = suggestions.filter((suggestion) => suggestion.canAnswer);
  const unsuggested = (report.data?.entries ?? []).filter((entry): entry is Unsuggested =>
    UNSUGGESTED.has(entry.outcome)
  );

  const actions = (suggestion: IngredientSuggestion) =>
    suggestion.canAnswer ? (
      <div className="flex justify-end gap-2">
        <Button
          data-testid="ingredient-suggestion-dismiss"
          size="sm"
          variant="danger-soft"
          onPress={() => void dismiss([suggestion.id])}
        >
          {t("dismissSuggestion")}
        </Button>
        <Button
          data-testid="ingredient-suggestion-confirm"
          size="sm"
          variant="secondary"
          onPress={() => void confirm([suggestion.id])}
        >
          {t("confirmSuggestion")}
        </Button>
      </div>
    ) : null;

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
            <DataTable
              aria-label={t("suggestionsTitle")}
              columns={[
                {
                  key: "ingredient",
                  label: t("suggestionColumns.ingredient"),
                  isRowHeader: true,
                  className: "font-medium",
                  render: (suggestion) => ingredientDisplayName(suggestion.ingredient, locale),
                },
                {
                  key: "proposal",
                  label: t("suggestionColumns.proposal"),
                  render: (suggestion) => suggestionProposal(t, suggestion, locale),
                },
                {
                  key: "basis",
                  label: t("suggestionColumns.basis"),
                  className: "text-muted",
                  hideOnNarrow: true,
                  render: (suggestion) => suggestionTrace(t, suggestion),
                },
                {
                  key: "actions",
                  label: t("suggestionColumns.actions"),
                  align: "end",
                  render: actions,
                },
              ]}
              rowKey={(suggestion) => suggestion.id}
              rowProps={(suggestion) => ({
                "data-testid": "ingredient-suggestion",
                "data-kind": suggestion.kind,
                "data-source": suggestion.source,
              })}
              rows={suggestions}
            />
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
              <DataTable
                aria-label={t("suggestionsNone")}
                columns={[
                  {
                    key: "ingredient",
                    label: t("suggestionColumns.ingredient"),
                    isRowHeader: true,
                    className: "font-medium",
                    render: (entry) => entry.name ?? entry.ingredientId,
                  },
                  {
                    key: "outcome",
                    label: t("suggestionColumns.outcome"),
                    render: (entry) => (
                      <Chip color={UNSUGGESTED_COLOR[entry.outcome]} size="sm" variant="soft">
                        {t(`reportOutcomes.${entry.outcome}`)}
                      </Chip>
                    ),
                  },
                  {
                    key: "detail",
                    label: t("suggestionColumns.basis"),
                    className: "text-muted",
                    hideOnNarrow: true,
                    render: (entry) =>
                      entry.outcome === "skipped"
                        ? skippedReason(t, entry.reason)
                        : entry.outcome === "failed"
                          ? entry.error
                          : reviewTrace(t, entry),
                  },
                ]}
                rowKey={(entry) => entry.ingredientId}
                rowProps={(entry) => ({
                  "data-testid": "ingredients-review-entry",
                  "data-outcome": entry.outcome,
                })}
                rows={unsuggested}
              />
            </section>
          ) : null}
        </div>
      </Panel.Body>
      {answerable.length > 0 ? (
        <Panel.Footer>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              data-testid="ingredient-suggestions-dismiss-all"
              variant="ghost"
              onPress={() => void dismiss(answerable.map((suggestion) => suggestion.id))}
            >
              {t("dismissAll")}
            </Button>
            <Button
              data-testid="ingredient-suggestions-confirm-all"
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
