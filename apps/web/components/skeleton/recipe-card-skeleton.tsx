"use client";

import { memo } from "react";
import { Card, Skeleton } from "@heroui/react";

type RecipeCardSkeletonProps = {
  variant?: "grid" | "list";
};

function RecipeCardSkeletonComponent({ variant = "grid" }: RecipeCardSkeletonProps) {
  if (variant === "list") {
    return (
      <Card data-recipe-card className="h-[128px] w-full gap-0 overflow-hidden rounded-2xl p-0">
        <div className="flex h-full min-w-0 items-stretch">
          <Skeleton className="h-full w-[112px] shrink-0 rounded-none" />
          <Card.Content className="min-w-0 flex-1 px-4 py-3">
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="mt-3 h-3 w-full rounded" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </Card.Content>
        </div>
      </Card>
    );
  }

  return (
    <Card data-recipe-card className="h-[340px] w-full gap-0 overflow-hidden rounded-3xl p-0">
      <div className="relative h-[236px] w-full overflow-hidden">
        <Skeleton className="absolute inset-0 h-full w-full" />
      </div>
      <Card.Content className="h-[104px] px-4 pt-3 pb-3">
        <Skeleton className="h-4 w-3/4 rounded" />
        <div className="mt-2 space-y-2">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-5/6 rounded" />
        </div>
      </Card.Content>
    </Card>
  );
}

// Memoize skeleton - it has no props so it never needs to re-render
const RecipeCardSkeleton = memo(RecipeCardSkeletonComponent);

RecipeCardSkeleton.displayName = "RecipeCardSkeleton";

export default RecipeCardSkeleton;
