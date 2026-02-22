// Re-export for backwards compatibility
export { default as RecipeSkeletonDesktop } from "./recipe-skeleton-desktop";
export { default as RecipeSkeletonMobile } from "./recipe-skeleton-mobile";

// Default export that renders both with responsive visibility
import RecipeSkeletonDesktop from "./recipe-skeleton-desktop";
import RecipeSkeletonMobile from "./recipe-skeleton-mobile";

export default function RecipeSkeleton() {
  return (
    <>
      <div className="hidden md:block">
        <RecipeSkeletonDesktop />
      </div>
      <div className="md:hidden">
        <RecipeSkeletonMobile />
      </div>
    </>
  );
}
