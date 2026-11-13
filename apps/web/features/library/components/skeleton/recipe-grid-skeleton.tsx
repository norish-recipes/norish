"use client";

import { Tabs } from "@heroui/react";

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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 50 }).map((_, i) => (
        <RecipeCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Grey cards in the grid and list panels of the view mode tabs, as both Library skeletons draw. */
export function RecipeGridSkeletonPanels() {
  return (["grid", "list"] as const).map((variant) => (
    <Tabs.Panel key={variant} className="mt-0 min-h-0 flex-1 p-0" id={variant}>
      <RecipeGridSkeleton variant={variant} />
    </Tabs.Panel>
  ));
}
