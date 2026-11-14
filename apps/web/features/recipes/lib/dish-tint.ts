import type { CSSProperties } from "react";

import { dishHueChroma, MAX_DISH_TINT_CHROMA } from "@norish/shared/lib/oklab";

/**
 * The Dish Colour → page-tint derivation (ADR-0023). The stored colour is a
 * `#rrggbb` the server extracted from the recipe's primary image; what the
 * page may take from it is its hue and a clamped amount of its saturation,
 * expressed as two OKLCH channel variables. Lightness never appears here —
 * the CSS in globals.css rebuilds each surface token from the theme's own
 * lightness (`oklch(from var(--untinted-*) l ...)`), which is the whole
 * safety argument: a recipe decides what colour its page is and never
 * decides how readable it is.
 *
 * A recipe with no colour, an unparseable value, and a reader who declined
 * the tint all land on the same `undefined` — one untinted rendering,
 * reached three ways, built once.
 */

export { MAX_DISH_TINT_CHROMA };

type DishTintStyle = CSSProperties & {
  "--dish-h": string;
  "--dish-c": string;
};

/**
 * The scoped variables for one Dish Colour, or undefined when there is
 * nothing to tint with — no colour stored, or a value that is not the
 * `#rrggbb` the extractor writes. Undefined means the container emits no
 * variables at all and the page renders on the plain theme tokens.
 */
export function dishTintStyle(dishColor: string | null | undefined): DishTintStyle | undefined {
  const tint = dishHueChroma(dishColor);

  if (!tint) return undefined;

  return {
    "--dish-h": tint.h.toFixed(2),
    "--dish-c": tint.c.toFixed(4),
  };
}
