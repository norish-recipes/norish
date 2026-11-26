import React from "react";
import { View } from "react-native";
import { CountCardSkeleton } from "@/components/count-row";
import { Skeleton } from "heroui-native";

const ROWS = 6;

/** The list while it loads: the search field and a card of rows, shaped like the loaded page. */
export function ContentSkeleton() {
  return (
    <View testID="content-skeleton">
      <View className="px-5 pt-3 pb-1">
        <Skeleton className="h-12 rounded-full" />
      </View>
      <View className="pt-4">
        <CountCardSkeleton rows={ROWS} />
      </View>
    </View>
  );
}
