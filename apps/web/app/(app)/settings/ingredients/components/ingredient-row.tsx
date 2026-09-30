"use client";

import { memo } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Spinner } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import { IngredientStatusChip } from "./ingredient-status-chip";

/** One spelling of a food; `canRemove` is `edit` on the alias, which moving it needs too. */
export interface Spelling {
  id: string;
  text: string;
  locale?: string | null;
  seeded?: boolean;
  canRemove: boolean;
}

export interface IngredientItem {
  id: string;
  name: string;
  localeNames?: LocaleNames;
  flagged: boolean;
  flagReason?: FlagReason | null;
  parent: { id: string; name: string; localeNames?: LocaleNames } | null;
  /** How many foods are kinds of this one. */
  kinds: number;
  canEdit: boolean;
  /** The viewer's spellings; the server keeps the other languages' until asked. */
  aliases: Spelling[];
  hiddenSpellings?: number;
}

/** How far each level of the tree is set in from the one above. */
const INDENT_PX = 24;

/**
 * One Ingredient of the catalogue, folded to a line: its name in the
 * viewer's language, its flag and why, and how many spellings it goes by.
 * Pressing it opens the Ingredient's panel, where the spellings and every
 * edit the server says the viewer may make live. In the page's tree a food
 * with kinds carries a chevron that folds them out beneath it, set in by
 * `depth`. `reviewing` is the food's turn in a round of Ask AI: the row
 * shows it in place of its flag, and settles as its own change when the
 * answer lands. A row re-renders only when its own item or turn changes, so
 * a page of fifty rows stays out of the way of typing.
 */
export const IngredientRow = memo(function IngredientRow({
  item,
  depth = 0,
  expanded = false,
  loadingKinds = false,
  reviewing = false,
  onOpen,
  onToggleKinds,
}: {
  item: IngredientItem;
  depth?: number;
  expanded?: boolean;
  loadingKinds?: boolean;
  reviewing?: boolean;
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
          ) : expanded ? (
            <ChevronDownIcon className="size-4" />
          ) : (
            <ChevronRightIcon className="size-4" />
          )}
        </button>
      ) : null}
      <button
        className="focus-visible:ring-focus flex min-w-0 flex-1 cursor-[var(--cursor-interactive)] items-center gap-3 rounded-lg px-3 py-3 text-left focus-visible:ring-2 focus-visible:outline-none"
        data-testid="ingredient-toggle"
        type="button"
        onClick={() => onOpen(item.id)}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 truncate font-medium">{displayName}</span>
            {displayName !== item.name ? (
              <span className="text-muted truncate text-sm">{item.name}</span>
            ) : null}
            <IngredientStatusChip flagged={item.flagged} reviewing={reviewing} />
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
        <ChevronRightIcon aria-hidden className="text-muted size-4 shrink-0" />
      </button>
    </div>
  );
});
