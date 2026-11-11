"use client";

import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { useDebounceValue } from "usehooks-ts";

import { useIngredientIconAddress, useIngredientsNamed } from "@norish/shared-react/ingredients";
import { addBasePath } from "@norish/shared/lib/base-path";

/**
 * The sizes an Ingredient Icon is shown at: beside a step's chip, a line or
 * a row (smaller on a phone, where every pixel beside a line wraps it), and
 * in its panel.
 */
const SIZES = { chip: "size-5", line: "size-6 md:size-8", panel: "size-16" } as const;

export type IngredientIconSize = keyof typeof SIZES;

/** How long typing pauses before a typed name is looked up. */
const FIND_DELAY_MS = 400;

/**
 * The food each typed name already names, by the name, or null where it
 * names none yet: what an editor row shows the icon of as soon as Norish
 * knows what was typed. A reader: it never mints. Names are looked up once
 * typing pauses; a name not looked up yet answers nothing.
 */
export function useFoodsByName(names: readonly string[]): ReadonlyMap<string, string | null> {
  const [typed] = useDebounceValue(
    [...new Set(names.filter((name) => name !== ""))].join("\n"),
    FIND_DELAY_MS
  );

  return useIngredientsNamed(typed ? typed.split("\n") : []);
}

/**
 * An Ingredient Icon: a small picture of the food standing on nothing,
 * decoration beside its name and never in place of it. A food with no icon
 * anywhere shows nothing, nor does a line whose food the server has not
 * resolved yet; only while the surface's read is on its way does it hold an
 * empty slot, so the line does not jump when the icon lands. `placeholder`
 * shows a muted leaf on the icon's tile instead of nothing, for the
 * Ingredients list and the panel field an icon is set in. A reader who hid
 * icons gets none of these. A heading is not a food and
 * is given no icon at all. `src` is the address outright, where a surface has
 * it (the share page exposes no ids); otherwise the surface's read is looked
 * up by `ingredientId`.
 */
export function IngredientIcon({
  ingredientId,
  src,
  ...shown
}: {
  ingredientId?: string | null;
  src?: string | null;
} & Shown) {
  const { showIngredientIcons } = useHiddenItemVisibility();

  if (!showIngredientIcons) return null;
  // A line whose food the server has not resolved yet reads nothing and shows nothing.
  if (src !== undefined || !ingredientId) {
    return <IconPicture address={src ?? null} reading={false} {...shown} />;
  }

  return <CachedIngredientIcon ingredientId={ingredientId} {...shown} />;
}

type Shown = { size?: IngredientIconSize; placeholder?: boolean; className?: string };

/** An icon looked up by its food in the surface's read, holding its slot until that answers. */
function CachedIngredientIcon({ ingredientId, ...shown }: { ingredientId: string } & Shown) {
  const address = useIngredientIconAddress(ingredientId);

  return <IconPicture address={address ?? null} reading={address === undefined} {...shown} />;
}

function IconPicture({
  address,
  reading,
  size = "line",
  placeholder = false,
  className = "",
}: { address: string | null; reading: boolean } & Shown) {
  if (!address) {
    if (placeholder) {
      return (
        <span
          aria-hidden
          className={`bg-surface-secondary text-muted flex shrink-0 items-center justify-center rounded-[30%] ${SIZES[size]} ${className}`}
          data-testid="ingredient-icon-placeholder"
        >
          <svg
            className="size-1/2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path d="M5 19C5 10.5 10 5 19 5c0 9-5.5 14-14 14Z" />
            <path d="M5 19l8-8" />
          </svg>
        </span>
      );
    }
    if (!reading) return null;

    return <span aria-hidden className={`block shrink-0 ${SIZES[size]} ${className}`} />;
  }

  return (
    <img
      aria-hidden
      alt=""
      className={`block shrink-0 object-contain ${SIZES[size]} ${className}`}
      data-testid="ingredient-icon"
      decoding="async"
      loading="lazy"
      src={addBasePath(address)}
    />
  );
}
