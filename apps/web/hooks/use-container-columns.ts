import { useViewport } from "@/hooks/use-viewport";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

/**
 * The library's column count from the window width, at Tailwind's `lg`
 * breakpoint: in the grid 2 on phones and tablets and 4 on desktops, in the
 * list 1 and 2. The main column stops growing at `max-w-7xl`, so a wider
 * window gains margin, not room for another column.
 *
 * One breakpoint, matching the desktop Device Kind's assumed window, so the
 * server's columns are the browser's on every desktop.
 */
export function useContainerColumns(viewMode: RecipeViewMode = "grid"): number {
  return useViewport((width) => {
    const wide = width >= 1024;

    if (viewMode === "list") return wide ? 2 : 1;

    return wide ? 4 : 2;
  });
}
