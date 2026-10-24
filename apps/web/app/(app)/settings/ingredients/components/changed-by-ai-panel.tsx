"use client";

import type { AIChange } from "@/components/ingredients/types";
import type { ReactNode } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AIChangeActions } from "@/components/ingredients/ai-change-actions";
import { IngredientPanel } from "@/components/ingredients/ingredient-panel";
import { changeMessage } from "@/components/ingredients/review-copy";
import { isOpenChange, useAIChanges } from "@/components/ingredients/use-ai-changes";
import Panel from "@/components/Panel/Panel";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLocale, useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

/** One line of the panel: all it shows is one virtualised run of these. */
type PanelRow =
  | { kind: "empty" }
  | { kind: "heading"; of: "unsure" | "sure" }
  | { kind: "change"; change: AIChange };

/** What each kind of row is likely to measure, until the virtualizer has measured it. */
const ESTIMATED_HEIGHT: Record<PanelRow["kind"], number> = {
  empty: 44,
  heading: 40,
  change: 72,
};
const ROW_OVERSCAN = 8;

function rowKey(row: PanelRow): string {
  switch (row.kind) {
    case "change":
      return `change:${row.change.id}`;
    case "heading":
      return `${row.kind}:${row.of}`;
    default:
      return row.kind;
  }
}

/**
 * The panel's rows, virtualised against the panel's own scrolling body: a month
 * may hold a thousand changes, a row each with a button or two, and only the
 * rows in and around view are in the tree.
 * Rows carry their own spacing; the virtualizer measures each one.
 */
function VirtualRows({
  rows,
  render,
}: {
  rows: readonly PanelRow[];
  render: (row: PanelRow, index: number) => ReactNode;
}) {
  // TanStack Virtual hands back one mutable instance, so compiled memoisation
  // would keep its first rows.
  "use no memo";

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
    estimateSize: (index) => ESTIMATED_HEIGHT[rows[index]?.kind ?? "change"],
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
      data-testid="ingredients-ai-changes"
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
 * Changed by AI: the last month's AI Changes, open ones first with Keep and Undo. A name opens
 * its panel.
 */
export function ChangedByAIPanel({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** A food's panel changed it: the page reads its lists again. */
  onChanged: () => void;
}) {
  const t = useTranslations("settings.ingredients");
  const locale = useLocale();
  const { changes, keep, undo } = useAIChanges();
  // The food whose own panel is open over this one.
  const [openId, setOpenId] = useState<string | null>(null);

  // Everything the panel shows, in order, as the rows of one list.
  const rows = useMemo(() => {
    const out: PanelRow[] = [];
    const unsure = changes.filter(isOpenChange);
    const rest = changes.filter((change) => !isOpenChange(change));

    if (changes.length === 0) out.push({ kind: "empty" });
    if (unsure.length > 0) out.push({ kind: "heading", of: "unsure" });
    for (const change of unsure) out.push({ kind: "change", change });
    // A heading for the rest only sets them apart from the unsure ones above.
    if (unsure.length > 0 && rest.length > 0) out.push({ kind: "heading", of: "sure" });
    for (const change of rest) out.push({ kind: "change", change });

    return out;
  }, [changes]);

  /** A food's name, opening its panel. */
  const foodName = (ingredientId: string, name: string) => (
    <button
      className="text-accent focus-visible:ring-focus min-w-0 cursor-[var(--cursor-interactive)] rounded text-left text-sm font-medium break-words hover:underline focus-visible:ring-2 focus-visible:outline-none"
      data-testid="ingredient-ai-change-open"
      type="button"
      onClick={() => setOpenId(ingredientId)}
    >
      {name}
    </button>
  );

  /** What a change is listed under: its food, or a deleted food's name. */
  const subjectName = (change: AIChange): ReactNode => {
    if (change.ingredient) {
      return foodName(change.ingredient.id, ingredientDisplayName(change.ingredient, locale));
    }

    return <span className="min-w-0 text-sm font-medium break-words">{change.from}</span>;
  };

  /** One row. A row in a run of its kind is ruled off from the one above it. */
  const renderRow = (row: PanelRow, index: number): ReactNode => {
    const ruled = index > 0 && rows[index - 1]?.kind === row.kind;

    switch (row.kind) {
      case "empty":
        return <p className="text-muted py-3 text-sm">{t("changedByAI.empty")}</p>;
      case "heading":
        return (
          <h3
            className={twMerge(
              "text-muted pb-1 text-xs font-semibold tracking-wide uppercase",
              index > 0 && "pt-4"
            )}
          >
            {t(`changedByAI.${row.of}`)}
          </h3>
        );
      case "change": {
        const { change } = row;

        return (
          <div
            className={twMerge(
              "flex items-start justify-between gap-3 py-3",
              ruled && "border-border/40 border-t"
            )}
            data-kind={change.kind}
            data-sure={change.sure}
            data-testid="ingredient-ai-change"
          >
            <div className="flex min-w-0 flex-col items-start">
              {subjectName(change)}
              <span className="text-sm break-words">{changeMessage(t, change, locale)}</span>
            </div>
            <AIChangeActions
              change={change}
              onKeep={(it) => void keep(it)}
              onUndo={(it) => void undo(it)}
            />
          </div>
        );
      }
    }
  };

  return (
    <Panel
      open={open}
      title={t("changedByAI.title")}
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        setOpenId(null);
        onClose();
      }}
    >
      <Panel.Body>
        <VirtualRows render={renderRow} rows={rows} />
      </Panel.Body>

      <IngredientPanel
        nested
        id={openId}
        item={null}
        open={openId !== null}
        onChanged={onChanged}
        onClose={() => setOpenId(null)}
      />
    </Panel>
  );
}
