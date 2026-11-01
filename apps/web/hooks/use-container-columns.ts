import { useViewport } from "@/hooks/use-viewport";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

/**
 * The library's column count from the window width. The grid has 2 columns on
 * phones and tablets and 4 from Tailwind's `lg`. The list has 1, then 2 from
 * `lg` and 3 from `xl`, where the main column reaches its `max-w-7xl` width;
 * a wider window gains margin, not room for a fourth.
 */
export function useContainerColumns(viewMode: RecipeViewMode = "grid"): number {
  return useViewport((width) => {
    if (viewMode === "list") return width < 1024 ? 1 : width < 1280 ? 2 : 3;

    return width < 1024 ? 2 : 4;
  });
}
