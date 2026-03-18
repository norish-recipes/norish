import RecipeSkeletonDesktop from "@/components/skeleton/recipe-skeleton-desktop";
import RecipeSkeletonMobile from "@/components/skeleton/recipe-skeleton-mobile";

export default function Loading() {
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
