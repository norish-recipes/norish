// Default export that renders both with responsive visibility
import type { ComponentProps } from "react";

import RecipeSkeletonDesktop from "./recipe-skeleton-desktop";
import RecipeSkeletonMobile from "./recipe-skeleton-mobile";

// Re-export for backwards compatibility
export { default as RecipeSkeletonDesktop } from "./recipe-skeleton-desktop";
export { default as RecipeSkeletonMobile } from "./recipe-skeleton-mobile";

/** `rating` and `nutrition` draw or leave out those placeholders whatever the reader hid. */
export default function RecipeSkeleton(parts: ComponentProps<typeof RecipeSkeletonDesktop>) {
  return (
    <>
      <div className="hidden md:block">
        <RecipeSkeletonDesktop {...parts} />
      </div>
      <div className="md:hidden">
        <RecipeSkeletonMobile {...parts} />
      </div>
    </>
  );
}
