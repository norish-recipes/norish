"use client";

import { Card, Skeleton, CardBody } from "@heroui/react";
import { memo } from "react";

function RecipeCardSkeletonComponent() {
  return (
    <Card data-recipe-card className="w-full bg-transparent shadow-none">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
        <Skeleton className="absolute inset-0 h-full w-full" />
      </div>
      <CardBody className="py-3 pr-0 pr-3 pl-0">
        <Skeleton className="h-4 w-3/4 rounded" />
        <div className="mt-2 space-y-2">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-5/6 rounded" />
        </div>
      </CardBody>
    </Card>
  );
}

// Memoize skeleton - it has no props so it never needs to re-render
const RecipeCardSkeleton = memo(RecipeCardSkeletonComponent);

RecipeCardSkeleton.displayName = "RecipeCardSkeleton";

export default RecipeCardSkeleton;
