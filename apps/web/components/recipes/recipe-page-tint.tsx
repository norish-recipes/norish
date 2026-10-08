"use client";

import type { ReactNode } from "react";
import { useRecipePageColor } from "@/context/recipe-page-color-context";
import { dishTintStyle } from "@/lib/dish-tint";

/**
 * The one place a recipe page takes its hue from the dish (ADR-0023). The
 * scope carries two OKLCH channel variables and an attribute the CSS in
 * globals.css keys on to rebuild the background and surface tokens at the
 * theme's own lightness; the fixed underlay repaints the viewport in the
 * scoped background so the tint reaches the ground around a centred column,
 * not just the column itself.
 *
 * `display: contents` keeps this out of layout entirely: wrapping a page in
 * it moves no pixel of the untinted rendering.
 *
 * With nothing to tint with — no Dish Colour stored, or a reader whose
 * recipe page colour preference is `theme` — no attribute, no variables
 * and no underlay are emitted: both resolve through the same
 * `dishTintStyle(null)` and the untinted page is the plain theme rendering
 * itself, not a tint at zero strength. The preference is seeded server-side
 * (and read from the restored profile Offline), so an opted-out reader never
 * renders a tinted frame on any load path.
 */
export default function RecipePageTint({
  dishColor,
  children,
}: {
  dishColor: string | null | undefined;
  children: ReactNode;
}) {
  const [colorMode] = useRecipePageColor();
  const style = dishTintStyle(colorMode === "dish" ? dishColor : null);

  return (
    <div className="contents" data-dish-tint={style ? true : undefined} style={style}>
      {style && (
        <div aria-hidden className="bg-background pointer-events-none fixed inset-0 -z-10" />
      )}
      {children}
    </div>
  );
}
