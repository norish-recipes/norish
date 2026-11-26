import React from "react";
import { View } from "react-native";
import { CardSlice } from "@/components/card-slice";
import { edgeAt } from "@/lib/card-edges";
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
        {Array.from({ length: ROWS }, (_, index) => (
          <CardSlice key={index} edge={edgeAt(index, ROWS)}>
            <View className="min-h-[52px] justify-center px-4">
              <Skeleton className="h-4 w-40 rounded-lg" />
            </View>
          </CardSlice>
        ))}
      </View>
    </View>
  );
}
