import React from "react";
import { View } from "react-native";
import { EmptyCard } from "@/components/empty-card";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

/** Nothing on the list yet: groceries come from a recipe or from Add items. */
export function GroceriesEmpty() {
  const intl = useIntl();

  return (
    <EmptyCard
      description={intl.formatMessage({ id: "groceries.mobile.emptyHint" })}
      icon="cart-outline"
      testID="groceries-empty"
      title={intl.formatMessage({ id: "groceries.empty.title" })}
    />
  );
}

/** What the list looks like while it loads: two sections of rows, in the real shells. */
export function GroceriesSkeleton() {
  return (
    <View className="gap-3.5 px-5" testID="groceries-skeleton">
      {[4, 3].map((rows) => (
        <View key={rows} className="bg-surface overflow-hidden rounded-3xl">
          <View className="bg-default h-14 flex-row items-center gap-2.5 px-4">
            <Skeleton className="size-2.5 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-md" />
          </View>
          {Array.from({ length: rows }, (_, index) => (
            <View
              key={index}
              className="border-separator h-[63px] flex-row items-center gap-3.5 border-t px-4"
            >
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-5 flex-1 rounded-md" />
              <Skeleton className="h-5 w-12 rounded-md" />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
