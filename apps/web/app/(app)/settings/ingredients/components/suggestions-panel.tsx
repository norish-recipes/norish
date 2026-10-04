"use client";

import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import Panel from "@/components/Panel/Panel";
import { Button, Chip, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import type { ReviewReportEntry } from "@norish/shared/contracts/ingredient-catalogue";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import type { IngredientSuggestion } from "./use-ingredient-suggestions";
import { IngredientPanel } from "./ingredient-panel";
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

/** One food a round got no suggestion for, as the report lists it. */
type Unsuggested = Extract<ReviewReportEntry, { outcome: "unsure" | "skipped" | "failed" }>;

/**
 * What AI suggests for the catalogue, waiting on the viewer: one row per food
 * they may edit (the server lists no other), what is proposed and on what
 * basis, each confirmed or dismissed on its own, or all at once; an answered
 * row leaves the list at once. Rows, not a table: the panel is a phone's
 * width on every screen, and four columns scrolled it sideways.
 * Confirming makes the edit as the viewer's own.
 * Opened on its own when a round of Ask AI the viewer started ends, and from the page while
 * anything is waiting. Where this tab saw a round end, the foods it got no
 * suggestion for follow, with why: AI was not sure, the food was passed
 * over, or its question broke. A food's name opens its own panel over this
 * one, to look at it whole before answering; closing that comes back here.
 */
export function SuggestionsPanel({
  jobId,
  open,
  reviewing,
  onClose,
  onChanged,
}: {
  jobId: string | null;
  open: boolean;
  /** The foods a round of Ask AI is asking about, which a food's panel holds still. */
  reviewing: ReadonlySet<string>;
  onClose: () => void;
  /** A food's panel changed it: the page reads its lists again. */
  onChanged: () => void;
}) {
  const t = useTranslations("settings.ingredients");
  const locale = useLocale();
  const trpc = useTRPC();
  const { suggestions, confirm, dismiss } = useIngredientSuggestions();
  // The food whose own panel is open over this one.
  const [openId, setOpenId] = useState<string | null>(null);
  const report = useQuery({
    ...trpc.ingredients.reviewReport.queryOptions({ jobId: jobId ?? "" }),
    enabled: open && jobId !== null,
  });
  const unsuggested = (report.data?.entries ?? []).filter((entry): entry is Unsuggested =>
    UNSUGGESTED.has(entry.outcome)
  );

  const actions = (suggestion: IngredientSuggestion) => (
    <div className="flex shrink-0 gap-2">
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
  );

  /** A food's name, opening its panel; one gone since the round is only its name. */
  const foodName = (ingredientId: string, name: string, gone = false) =>
    gone ? (
      <span className="min-w-0 text-sm font-medium break-words">{name}</span>
    ) : (
      <button
        className="text-accent focus-visible:ring-focus min-w-0 cursor-[var(--cursor-interactive)] rounded text-left text-sm font-medium break-words hover:underline focus-visible:ring-2 focus-visible:outline-none"
        data-testid="ingredient-suggestion-open"
        type="button"
        onClick={() => setOpenId(ingredientId)}
      >
        {name}
      </button>
    );

  return (
    <Panel
      open={open}
      title={t("suggestionsTitle")}
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        setOpenId(null);
        onClose();
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
            <ul
              aria-label={t("suggestionsTitle")}
              className="divide-border/40 flex flex-col divide-y"
            >
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  className="flex flex-col gap-1 py-3"
                  data-kind={suggestion.kind}
                  data-source={suggestion.source}
                  data-testid="ingredient-suggestion"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col items-start">
                      {foodName(
                        suggestion.ingredient.id,
                        ingredientDisplayName(suggestion.ingredient, locale)
                      )}
                      <span className="text-sm break-words">
                        {suggestionProposal(t, suggestion, locale)}
                      </span>
                    </div>
                    {actions(suggestion)}
                  </div>
                  <p className="text-muted text-xs break-words">{suggestionTrace(t, suggestion)}</p>
                </li>
              ))}
            </ul>
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
              <ul
                aria-label={t("suggestionsNone")}
                className="divide-border/40 flex flex-col divide-y"
              >
                {unsuggested.map((entry) => (
                  <li
                    key={entry.ingredientId}
                    className="flex flex-col gap-1 py-3"
                    data-outcome={entry.outcome}
                    data-testid="ingredients-review-entry"
                  >
                    <div className="flex items-start justify-between gap-3">
                      {foodName(
                        entry.ingredientId,
                        entry.name ?? entry.ingredientId,
                        entry.outcome === "skipped" && entry.reason === "not-found"
                      )}
                      <Chip
                        className="shrink-0"
                        color={UNSUGGESTED_COLOR[entry.outcome]}
                        size="sm"
                        variant="soft"
                      >
                        {t(`reportOutcomes.${entry.outcome}`)}
                      </Chip>
                    </div>
                    <p className="text-muted text-xs break-words">
                      {entry.outcome === "skipped"
                        ? skippedReason(t, entry.reason)
                        : entry.outcome === "failed"
                          ? entry.error
                          : reviewTrace(t, entry)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </Panel.Body>
      {suggestions.length > 0 ? (
        <Panel.Footer>
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              data-testid="ingredient-suggestions-dismiss-all"
              variant="ghost"
              onPress={() => void dismiss(suggestions.map((suggestion) => suggestion.id))}
            >
              {t("dismissAll")}
            </Button>
            <Button
              data-testid="ingredient-suggestions-confirm-all"
              variant="primary"
              onPress={() => void confirm(suggestions.map((suggestion) => suggestion.id))}
            >
              {t("confirmAll", { count: suggestions.length })}
            </Button>
          </div>
        </Panel.Footer>
      ) : null}

      <IngredientPanel
        nested
        id={openId}
        item={null}
        open={openId !== null}
        reviewing={openId !== null && reviewing.has(openId)}
        onChanged={onChanged}
        onClose={() => setOpenId(null)}
      />
    </Panel>
  );
}
