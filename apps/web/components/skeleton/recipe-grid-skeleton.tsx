"use client";

import RecipeCardSkeleton from "./recipe-card-skeleton";

type RecipeGridSkeletonProps = {
  variant?: "grid" | "list";
};

export default function RecipeGridSkeleton({ variant = "grid" }: RecipeGridSkeletonProps) {
  if (variant === "list") {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 18 }).map((_, i) => (
          <RecipeCardSkeleton key={i} variant="list" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 50 }).map((_, i) => (
        <RecipeCardSkeleton key={i} />
      ))}
    </div>
  );
}
