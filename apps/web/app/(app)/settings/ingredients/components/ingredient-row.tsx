"use client";

import { memo } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { Chip } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { LocaleNames } from "@norish/shared/lib/ingredient-names";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

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
  canEdit: boolean;
  /** The viewer's spellings; the server keeps the other languages' until asked. */
  aliases: Spelling[];
  hiddenSpellings?: number;
}

/**
 * One Ingredient of the catalogue, folded to a line: its name in the
 * viewer's language, its flag and why, and how many spellings it goes by.
 * Pressing it opens the Ingredient's panel, where the spellings and every
 * edit the server says the viewer may make live. A row re-renders only when
 * its own item changes, so a page of fifty rows stays out of the way of
 * typing.
 */
export const IngredientRow = memo(function IngredientRow({
  item,
  onOpen,
}: {
  item: IngredientItem;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("settings.ingredients");
  const locale = useLocale();
  const displayName = ingredientDisplayName(item, locale);
  const hiddenSpellings = item.hiddenSpellings ?? 0;

  return (
    <li
      data-flagged={item.flagged}
      data-ingredient={item.name}
      data-testid="ingredient-row"
      id={item.id}
    >
      <button
        className="hover:bg-default/40 focus-visible:ring-focus flex w-full cursor-[var(--cursor-interactive)] items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
            {item.flagged ? (
              <Chip color="warning" data-testid="ingredient-flagged" size="sm" variant="soft">
                {t("flagged")}
              </Chip>
            ) : null}
          </div>
          <span className="text-muted text-sm">
            {item.flagged ? (
              <span data-testid="ingredient-flag-reason">
                {t(`flagReasons.${item.flagReason ?? "unknown"}`)}
              </span>
            ) : (
              t("summary", {
                spellings: item.aliases.length + hiddenSpellings,
                // An ICU select key, never an empty string: "none" reads as no parent.
                parent: item.parent ? ingredientDisplayName(item.parent, locale) : "none",
              })
            )}
          </span>
        </div>
        <ChevronRightIcon aria-hidden className="text-muted size-4 shrink-0" />
      </button>
    </li>
  );
});
