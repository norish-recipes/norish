"use client";

import { useState } from "react";
import { useHiddenItemsIfProvided } from "@/context/hidden-items-context";

/**
 * Fixed size scale: a call site picks a step rather than passing geometry, so
 * the pictures line up the same way on every surface.
 */
const SIZE_CLASSES = {
  /** Inside a step's ingredient chip. */
  xs: "size-5 rounded",
  /** Beside an editor row or a grocery line. */
  sm: "size-8 rounded-md",
  /** Beside a recipe's ingredient line. */
  md: "size-10 rounded-lg",
  /** The administration preview. */
  lg: "size-28 rounded-xl",
} as const;

export type IngredientIllustrationSize = keyof typeof SIZE_CLASSES;

type IngredientIllustrationProps = {
  imageUrl: string | null | undefined;
  size?: IngredientIllustrationSize;
  /** Always show, ignoring the reader's Hidden Items — for administration. */
  ignoreHidden?: boolean;
  className?: string;
};

/**
 * An Ingredient Illustration (ADR-0037): the small picture of what a line's
 * name means, shown beside it so an ingredient can be recognised at a glance.
 *
 * Decorative by design — the name beside it is the accessible label, so the
 * picture carries an empty alt. It renders nothing at all when there is no
 * picture, when the file will not load, or when the reader has hidden
 * ingredient pictures: a line without one simply lines up as text did before.
 *
 * A raw `<img>` rather than the Next image optimizer: the URL is versioned and
 * immutable, so the service worker's image cache is correct by construction
 * and the picture still shows offline.
 */
export function IngredientIllustration({
  imageUrl,
  size = "md",
  ignoreHidden = false,
  className = "",
}: IngredientIllustrationProps) {
  const hidden = useHiddenItemsIfProvided();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!imageUrl || imageUrl === failedSrc) return null;
  if (!ignoreHidden && hidden.includes("ingredientPictures")) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- immutable versioned URL, see above
    <img
      alt=""
      className={`ring-foreground/5 shrink-0 bg-white object-cover ring-1 ${SIZE_CLASSES[size]} ${className}`}
      data-testid="ingredient-illustration"
      decoding="async"
      draggable={false}
      loading="lazy"
      src={imageUrl}
      onError={() => setFailedSrc(imageUrl)}
    />
  );
}
