import React from "react";
import { View } from "react-native";
import { Skeleton } from "heroui-native";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

const ROWS = [0, 1, 2, 3, 4, 5];

/** The Library's loading state: placeholders the size of its cards, in the layout it will draw. */
export function LibrarySkeleton({ variant }: { variant: RecipeViewMode }) {
  return (
    <View
      className={
        variant === "grid" ? "flex-row flex-wrap justify-between gap-y-3 px-5" : "gap-3 px-5"
      }
      testID="library-skeleton"
    >
      {ROWS.map((row) =>
        variant === "grid" ? (
          <View key={row} className="w-[48%] flex-none">
            <Skeleton className="h-[286px] w-full rounded-3xl" />
          </View>
        ) : (
          <Skeleton key={row} className="h-[116px] w-full rounded-[20px]" />
        )
      )}
    </View>
  );
}
