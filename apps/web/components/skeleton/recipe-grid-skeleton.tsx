"use client";

import RecipeCardSkeleton from "./recipe-card-skeleton";

type RecipeGridSkeletonProps = {
  variant?: "grid" | "list";
};

// The columns match `useContainerColumns`, so the page keeps its shape when the cards arrive.
export default function RecipeGridSkeleton({ variant = "grid" }: RecipeGridSkeletonProps) {
  if (variant === "list") {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 18 }).map((_, i) => (
          <RecipeCardSkeleton key={i} variant="list" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 50 }).map((_, i) => (
        <RecipeCardSkeleton key={i} />
      ))}
    </div>
  );
}
