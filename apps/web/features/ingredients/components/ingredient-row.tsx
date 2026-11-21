"use client";

import { memo } from "react";
import { IngredientIcon } from "@/components/ingredients/ingredient-icon";
import { IngredientStatusChip } from "@/components/ingredients/ingredient-status-chip";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Spinner } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { IngredientItem } from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

/** How far each level of the tree is set in from the one above. */
const INDENT_PX = 24;

/** One Ingredient on a line, indented by `depth`; memoised to re-render only on its item. */
export const IngredientRow = memo(function IngredientRow({
  item,
  depth = 0,
  expanded = false,
  loadingKinds = false,
  onOpen,
  onToggleKinds,
}: {
  item: IngredientItem;
  depth?: number;
  expanded?: boolean;
  loadingKinds?: boolean;
  onOpen: (id: string) => void;
  /** Fold the food's kinds out or back; absent where the list is flat. */
  onToggleKinds?: (id: string) => void;
}) {
  const t = useTranslations("settings.ingredients");
  const locale = useLocale();
  const displayName = ingredientDisplayName(item, locale);
  const hiddenSpellings = item.hiddenSpellings ?? 0;
  const foldable = onToggleKinds !== undefined && item.kinds > 0;

  return (
    <div
      // The hover covers the whole line, indent and chevron included.
      className="hover:bg-default/40 flex items-stretch rounded-lg transition-colors"
      data-depth={depth}
      data-expanded={foldable ? expanded : undefined}
      data-flagged={item.flagged}
      data-ingredient={item.name}
      data-testid="ingredient-row"
      id={item.id}
      role="listitem"
      style={{ paddingInlineStart: `${depth * INDENT_PX}px` }}
    >
      {onToggleKinds ? (
        <button
          aria-expanded={foldable ? expanded : undefined}
          aria-label={
            expanded
              ? t("collapseKinds", { name: displayName })
              : t("expandKinds", { name: displayName })
          }
          className={`text-muted hover:text-foreground focus-visible:ring-focus flex w-8 shrink-0 cursor-[var(--cursor-interactive)] items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none ${
            foldable ? "" : "invisible"
          }`}
          data-testid="ingredient-kinds-toggle"
          disabled={!foldable}
          type="button"
          onClick={() => onToggleKinds(item.id)}
        >
          {loadingKinds ? (
            <Spinner color="current" size="sm" />
          ) : (
            <ChevronRightIcon
              className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${
                expanded ? "rotate-90" : ""
              }`}
            />
          )}
        </button>
      ) : null}
      <button
        className="focus-visible:ring-focus flex min-w-0 flex-1 cursor-[var(--cursor-interactive)] items-center gap-3 rounded-lg px-3 py-3 text-left focus-visible:ring-2 focus-visible:outline-none"
        data-testid="ingredient-toggle"
        type="button"
        onClick={() => onOpen(item.id)}
      >
        <IngredientIcon placeholder src={item.icon ?? null} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 truncate font-medium">{displayName}</span>
            {displayName !== item.name ? (
              <span className="text-muted truncate text-sm">{item.name}</span>
            ) : null}
            <IngredientStatusChip flagged={item.flagged} />
          </div>
          <span className="text-muted text-sm">
            {item.flagged ? (
              <span data-testid="ingredient-flag-reason">
                {t(`flagReasons.${item.flagReason ?? "unknown"}`)}
              </span>
            ) : (
              t("summary", {
                spellings: item.aliases.length + hiddenSpellings,
                kinds: item.kinds,
                // An ICU select key, never an empty string: "none" reads as no parent.
                parent: item.parent ? ingredientDisplayName(item.parent, locale) : "none",
              })
            )}
          </span>
        </div>
      </button>
    </div>
  );
});
