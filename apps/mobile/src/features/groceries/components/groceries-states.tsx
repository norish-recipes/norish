import type { ReactNode } from "react";
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
      tone="shop"
    />
  );
}

/** A card of skeleton rows in the real card's shell; a heading sits above the first row. */
export function SkeletonCard({
  rows,
  rowClassName,
  heading,
  className = "bg-surface",
  children,
}: {
  rows: number;
  rowClassName: string;
  heading?: ReactNode;
  /** The card's fill; a sheet's is `bg-sand`. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className={`${className} overflow-hidden rounded-3xl`}>
      {heading}
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          className={`flex-row items-center ${rowClassName} ${heading || index > 0 ? "border-separator border-t" : ""}`}
        >
          {children}
        </View>
      ))}
    </View>
  );
}

/** What the list looks like while it loads: two sections of rows, in the real shells. */
export function GroceriesSkeleton() {
  return (
    <View className="gap-3.5 px-5" testID="groceries-skeleton">
      {[4, 3].map((rows) => (
        <SkeletonCard
          key={rows}
          heading={
            <View className="bg-default h-14 flex-row items-center gap-2.5 px-4">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-md" />
            </View>
          }
          rowClassName="h-[63px] gap-3.5 px-4"
          rows={rows}
        >
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-5 flex-1 rounded-md" />
          <Skeleton className="h-5 w-12 rounded-md" />
        </SkeletonCard>
      ))}
    </View>
  );
}
