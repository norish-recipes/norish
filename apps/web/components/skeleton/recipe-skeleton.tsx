"use client";

import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";

import RecipeSkeletonDesktop from "./recipe-skeleton-desktop";
import RecipeSkeletonMobile from "./recipe-skeleton-mobile";

/**
 * The recipe page's shape while it loads, without the rating or nutrition the
 * reader hid. A page that decides those itself (the shared recipe) passes
 * `rating` and `nutrition` instead.
 */
export default function RecipeSkeleton({
  rating,
  nutrition,
}: {
  rating?: boolean;
  nutrition?: boolean;
}) {
  const shows = useHiddenItemVisibility();
  const parts = {
    showRatings: rating ?? shows.showRatings,
    showNutrition: nutrition ?? shows.showNutrition,
  };

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
