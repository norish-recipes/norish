"use client";

import { useHiddenItemVisibility } from "@/hooks/use-hidden-item-visibility";
import { useDebounceValue } from "usehooks-ts";

import { useIngredientIconAddress, useIngredientsNamed } from "@norish/shared-react/ingredients";
import { addBasePath } from "@norish/shared/lib/base-path";

/** An icon's size beside a chip, a line or row (smaller on a phone), or in its panel. */
const SIZES = { chip: "size-5", line: "size-6 md:size-8", panel: "size-16" } as const;

export type IngredientIconSize = keyof typeof SIZES;

/** How long typing pauses before a typed name is looked up. */
const FIND_DELAY_MS = 400;

/** The food each typed name names, or null, looked up once typing pauses; it never mints. */
export function useFoodsByName(names: readonly string[]): ReadonlyMap<string, string | null> {
  const [typed] = useDebounceValue(
    [...new Set(names.filter((name) => name !== ""))].join("\n"),
    FIND_DELAY_MS
  );

  return useIngredientsNamed(typed ? typed.split("\n") : []);
}

/**
 * A food's icon from `src`, else from the surface's read by `ingredientId`; an empty slot holds its
 * place while that read is pending.
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
