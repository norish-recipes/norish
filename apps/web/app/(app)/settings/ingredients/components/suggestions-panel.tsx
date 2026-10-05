"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import Panel from "@/components/Panel/Panel";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { Button, Chip, Label, ProgressBar, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLocale, useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import type { ReviewReportEntry } from "@norish/shared/contracts/ingredient-catalogue";
import type { ReviewRound } from "@norish/shared/contracts/realtime/ingredients";
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

/** One line of the panel: all it shows is one virtualised run of these. */
type PanelRow =
  | { kind: "round" }
  | { kind: "waiting"; ingredientId: string; name: string }
  | { kind: "empty" }
  | { kind: "suggestion"; suggestion: IngredientSuggestion }
  | { kind: "loading"; of: "waiting" | "report" }
  | { kind: "unsuggested-heading" }
  | { kind: "unsuggested"; entry: Unsuggested };

/** What each kind of row is likely to measure, until the virtualizer has measured it. */
const ESTIMATED_HEIGHT: Record<PanelRow["kind"], number> = {
  round: 72,
  waiting: 26,
  empty: 44,
  suggestion: 96,
  loading: 36,
  "unsuggested-heading": 40,
  unsuggested: 76,
};
const ROW_OVERSCAN = 8;

function rowKey(row: PanelRow): string {
  switch (row.kind) {
    case "waiting":
      return `waiting:${row.ingredientId}`;
    case "suggestion":
      return `suggestion:${row.suggestion.id}`;
    case "unsuggested":
      return `unsuggested:${row.entry.ingredientId}`;
    case "loading":
      return `loading:${row.of}`;
    default:
      return row.kind;
  }
}

/**
 * The panel's rows, virtualised against the panel's own scrolling body: a
 * round over the whole catalogue leaves a thousand suggestions, a row each
 * with two buttons, and only the rows in and around view are in the tree.
 * Rows carry their own spacing; the virtualizer measures each one.
 */
function VirtualRows({
  rows,
  render,
}: {
  rows: readonly PanelRow[];
  render: (row: PanelRow, index: number) => ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  // Where the list starts in the body, below its padding.
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    const body = list?.closest<HTMLElement>('[data-slot="panel-body"]');

    if (!list || !body) return;
    setScrollElement(body);
    setScrollMargin(list.offsetTop - body.offsetTop);
  }, []);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: (index) => ESTIMATED_HEIGHT[rows[index]?.kind ?? "suggestion"],
    getItemKey: (index) => {
      const row = rows[index];

      return row ? rowKey(row) : index;
    },
    overscan: ROW_OVERSCAN,
    scrollMargin,
  });

  return (
    <div
      ref={listRef}
      // The panel's body lays its children out as a column: the list keeps its full height there.
      className="relative w-full shrink-0"
      data-testid="ingredients-suggestions"
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index];

        if (!row) return null;

        return (
          <div
            key={item.key}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full"
            data-index={item.index}
            style={{ transform: `translateY(${item.start - scrollMargin}px)` }}
          >
            {render(row, item.index)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * What AI suggests for the catalogue, waiting on the viewer: one row per food
 * they may edit (the server lists no other), what is proposed and on what
 * basis, each confirmed or dismissed on its own, or all at once; an answered
 * row leaves the list at once. Rows, not a table: the panel is a phone's
 * width on every screen, and four columns scrolled it sideways. The rows are
 * virtualised, since a round over the catalogue leaves a thousand of them.
 * Confirming makes the edit as the viewer's own.
 * Opened on its own when a round of Ask AI the viewer started ends, and from the page while
 * anything is waiting. While a round runs, it leads with how far the round
 * has come and, folded, the foods it has still to ask about. Where this tab
 * saw a round, the foods it got no suggestion for follow, with why: AI was
 * not sure, the food was passed over, or its question broke. A food's name
 * opens its own panel over this one, to look at it whole before answering;
 * closing that comes back here.
 */
export function SuggestionsPanel({
  jobId,
  round,
  open,
  reviewing,
  onClose,
  onChanged,
}: {
  jobId: string | null;
  /** The round of Ask AI running on the instance, if any. */
  round: ReviewRound | null;
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
  // Whether the round's waiting foods are folded out.
  const [waitingOpen, setWaitingOpen] = useState(false);
  // The round running now, else the last one this tab saw end.
  const reportJobId = round?.jobId ?? jobId;
  const report = useQuery({
    ...trpc.ingredients.reviewReport.queryOptions({ jobId: reportJobId ?? "" }),
    enabled: open && reportJobId !== null,
  });
  const reportData = report.data;
  const reportLoading = report.isFetching && !reportData;

  // Everything the panel shows, in order, as the rows of one list.
  const rows = useMemo(() => {
    const out: PanelRow[] = [];
    const waiting = reportData?.waiting ?? [];

    if (round) {
      out.push({ kind: "round" });
      if (waitingOpen && round.pending.length > 0) {
        if (waiting.length === 0) out.push({ kind: "loading", of: "waiting" });
        for (const food of waiting) out.push({ kind: "waiting", ...food });
      }
    }
    if (suggestions.length === 0) out.push({ kind: "empty" });
    for (const suggestion of suggestions) out.push({ kind: "suggestion", suggestion });
    if (reportLoading) out.push({ kind: "loading", of: "report" });
    const unsuggested = (reportData?.entries ?? []).filter((entry): entry is Unsuggested =>
      UNSUGGESTED.has(entry.outcome)
    );

    if (unsuggested.length > 0) {
      out.push({ kind: "unsuggested-heading" });
      for (const entry of unsuggested) out.push({ kind: "unsuggested", entry });
    }

    return out;
  }, [round, waitingOpen, suggestions, reportData, reportLoading]);

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

  /**
   * One row. A row in a run of its kind is ruled off from the one above it,
   * and the first after the round's waiting foods keeps a gap from them,
   * padded rather than margined so the virtualizer measures it.
   */
  const renderRow = (row: PanelRow, index: number): ReactNode => {
    const above = index > 0 ? rows[index - 1]?.kind : undefined;
    const ruled = above === row.kind;
    const afterWaiting = above === "waiting" && row.kind !== "waiting";

    switch (row.kind) {
      case "round":
        return round ? (
          <section className="flex flex-col gap-2 pb-2" data-testid="ingredients-round">
            <ProgressBar size="sm" value={round.total > 0 ? (round.done / round.total) * 100 : 0}>
              <Label>{t("roundSection.title")}</Label>
              <ProgressBar.Output>
                {t("roundSection.progress", { done: round.done, total: round.total })}
              </ProgressBar.Output>
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            {round.pending.length > 0 ? (
              <button
                aria-expanded={waitingOpen}
                className="text-muted focus-visible:ring-focus flex w-full cursor-[var(--cursor-interactive)] items-center justify-between gap-2 rounded py-1 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
                data-testid="ingredients-round-waiting"
                type="button"
                onClick={() => setWaitingOpen(!waitingOpen)}
              >
                {t("roundSection.waiting", { count: round.pending.length })}
                <ChevronDownIcon
                  aria-hidden
                  className={twMerge(
                    "size-4 shrink-0 transition-transform motion-reduce:transition-none",
                    waitingOpen && "rotate-180"
                  )}
                />
              </button>
            ) : null}
          </section>
        ) : null;
      case "waiting":
        return <div className="flex py-0.5 ps-3">{foodName(row.ingredientId, row.name)}</div>;
      case "empty":
        return (
          <p className={twMerge("text-muted py-3 text-sm", afterWaiting && "pt-6")}>
            {t("suggestionsEmpty")}
          </p>
        );
      case "loading":
        return (
          <div className="flex justify-center py-2">
            <Spinner color="accent" size="sm" />
          </div>
        );
      case "suggestion": {
        const { suggestion } = row;

        return (
          <div
            className={twMerge(
              "flex flex-col gap-1 py-3",
              ruled && "border-border/40 border-t",
              afterWaiting && "pt-6"
            )}
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
          </div>
        );
      }
      case "unsuggested-heading":
        return (
          <h3 className="text-muted pt-4 pb-1 text-xs font-semibold tracking-wide uppercase">
            {t("suggestionsNone")}
          </h3>
        );
      case "unsuggested": {
        const { entry } = row;

        return (
          <div
            className={twMerge("flex flex-col gap-1 py-3", ruled && "border-border/40 border-t")}
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
          </div>
        );
      }
    }
  };

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
        <VirtualRows render={renderRow} rows={rows} />
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
