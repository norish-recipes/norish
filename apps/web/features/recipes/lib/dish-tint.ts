import type { CSSProperties } from "react";

import { oklchHueChromaFromSrgb } from "@norish/shared/lib/oklab";

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

/**
 * How much saturation a dish may put into the page ground. The theme's own
 * neutral ground sits at ~0.008–0.016 chroma, so this is a clearly visible
 * warmth without approaching the accent's 0.083; the cards take only a
 * fraction of it (globals.css), so the ceiling also sets how far a card can
 * stand off the ground.
 */
export const MAX_DISH_TINT_CHROMA = 0.05;

export type DishTintStyle = CSSProperties & {
  "--dish-h": string;
  "--dish-c": string;
};

const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

/**
 * The scoped variables for one Dish Colour, or undefined when there is
 * nothing to tint with — no colour stored, or a value that is not the
 * `#rrggbb` the extractor writes. Undefined means the container emits no
 * variables at all and the page renders on the plain theme tokens.
 */
export function dishTintStyle(dishColor: string | null | undefined): DishTintStyle | undefined {
  if (!dishColor) return undefined;

  const match = dishColor.match(HEX_COLOR_PATTERN);

  if (!match) return undefined;

  const value = parseInt(match[1]!, 16);
  const { h, c } = oklchHueChromaFromSrgb((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);

  return {
    "--dish-h": h.toFixed(2),
    "--dish-c": Math.min(c, MAX_DISH_TINT_CHROMA).toFixed(4),
  };
}
