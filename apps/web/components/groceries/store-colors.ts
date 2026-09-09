import type { CSSProperties } from "react";

import { storeHue } from "@norish/shared/lib/store-colors";

export {
  STORE_COLOR_KEYS,
  STORE_HUES,
  storeColorKey,
  storeHue,
} from "@norish/shared/lib/store-colors";

/**
 * The one property the page paints a Store's colour with. Set on the Store's
 * section — and on a swatch, a selector row or a manager row of its own — it
 * resolves through `light-dark()` to the hue for the theme in force, read off
 * the `color-scheme` the theme declares on its light and dark roots, and
 * everything beneath paints with `var(--store-color)`.
 */
export function storeColorStyle(color: string): CSSProperties {
  const hue = storeHue(color);

  return { "--store-color": `light-dark(${hue.light}, ${hue.dark})` } as CSSProperties;
}
