"use client";

import { CardFact } from "@/components/dashboard/card-facts";
import { ClockIcon, UserGroupIcon } from "@heroicons/react/20/solid";
import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * How many allergens a card names before folding the rest into a count.
 *
 * The list row gets fewer, because there it shares one line with the count,
 * the time and the servings — the same five-chip budget a recipe list row
 * keeps, so a cookbook row wraps no more often than the row above it.
 */
const VISIBLE_ALLERGENS = 3;
export const VISIBLE_ALLERGENS_IN_ROW = 2;

/**
 * The allergens a reader would meet somewhere inside a cookbook.
 *
 * Kept warning-coloured wherever it is drawn, including the overflow count, so
 * a danger is never folded away into a neutral "+N" — the same rule the recipe
 * card's tags follow.
 */
export function CookbookAllergenChips({
  allergens,
  chipClassName,
  visibleCount = VISIBLE_ALLERGENS,
}: {
  allergens: string[];
  chipClassName: string;
  visibleCount?: number;
}) {
  const visible = allergens.slice(0, visibleCount);
  const hidden = allergens.length - visible.length;

  return (
    <>
      {visible.map((tag) => (
        <Chip
          key={tag.toLowerCase()}
          className={`max-w-[8rem] min-w-0 ${chipClassName}`}
          color="warning"
          size="sm"
          variant="primary"
        >
          <Chip.Label className="truncate">{tag}</Chip.Label>
        </Chip>
      ))}

      {hidden > 0 && (
        <Chip
          className={`shrink-0 ${chipClassName}`}
          color="warning"
          size="sm"
          title={allergens.join(", ")}
          variant="primary"
        >
          <Chip.Label>+{hidden}</Chip.Label>
        </Chip>
      )}
    </>
  );
}

/**
 * What a cookbook states about itself: its recipe count, time and servings as
 * a card's plain facts, then, where the caller asks for them, its allergens as
 * warning chips.
 *
 * No wrapper: each caller lays them out its own way.
 */
export function CookbookMetadata({
  memberCount,
  timeLabel,
  servings,
  allergens,
  visibleAllergens,
  chipClassName = "",
}: {
  memberCount: number;
  timeLabel?: string;
  servings: number | null;
  /** Omitted where the caller draws them somewhere else on the card. */
  allergens?: string[];
  visibleAllergens?: number;
  chipClassName?: string;
}) {
  const t = useTranslations("recipes.cookbooks");

  return (
    <>
      <span className="flex items-center gap-1 sm:gap-1.5">
        <CardFact>{t("recipeCount", { count: memberCount })}</CardFact>
        {timeLabel && <CardFact icon={ClockIcon}>{timeLabel}</CardFact>}
        {typeof servings === "number" && servings > 0 && (
          <CardFact icon={UserGroupIcon}>{servings}</CardFact>
        )}
      </span>

      {allergens && allergens.length > 0 && (
        <CookbookAllergenChips
          allergens={allergens}
          chipClassName={chipClassName}
          visibleCount={visibleAllergens}
        />
      )}
    </>
  );
}
