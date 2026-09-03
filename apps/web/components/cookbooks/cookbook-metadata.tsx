"use client";

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

type ChipVariant = "soft" | "tertiary";

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
 * What a cookbook states about itself, in whichever chrome the caller needs.
 *
 * The same three facts are drawn twice per card — over the cover in grid, in
 * the content row in list — and over an arbitrary photo a chip has to carry
 * its own contrast rather than tint the picture (ADR-0020). That is the only
 * difference between the two, so it is a parameter rather than a second copy
 * of the cascade.
 *
 * Chips only, with no wrapper: each caller lays them out its own way.
 */
export function CookbookMetadata({
  memberCount,
  timeLabel,
  servings,
  allergens,
  visibleAllergens,
  chipClassName,
  chipVariant,
  iconClassName,
}: {
  memberCount: number;
  timeLabel?: string;
  servings: number | null;
  /** Omitted where the caller draws them somewhere else on the card. */
  allergens?: string[];
  visibleAllergens?: number;
  chipClassName: string;
  chipVariant: ChipVariant;
  iconClassName: string;
}) {
  const t = useTranslations("recipes.cookbooks");

  return (
    <>
      <Chip className={`shrink-0 ${chipClassName}`} size="sm" variant={chipVariant}>
        <Chip.Label>{t("recipeCount", { count: memberCount })}</Chip.Label>
      </Chip>

      {timeLabel && (
        <Chip className={`shrink-0 ${chipClassName}`} size="sm" variant={chipVariant}>
          <ClockIcon className={iconClassName} />
          <Chip.Label>{timeLabel}</Chip.Label>
        </Chip>
      )}

      {typeof servings === "number" && servings > 0 && (
        <Chip className={`shrink-0 ${chipClassName}`} size="sm" variant={chipVariant}>
          <UserGroupIcon className={iconClassName} />
          <Chip.Label>{servings}</Chip.Label>
        </Chip>
      )}

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
