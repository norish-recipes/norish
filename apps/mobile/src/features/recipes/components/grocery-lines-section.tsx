import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { Card } from "@/components/card";
import { PillButton } from "@/components/pill-button";
import { Skeleton } from "heroui-native";

/** A section's heading bar inside its card, as web draws a Store's: name, count, then select-all. */
const HEADER = "min-h-[54px] flex-row items-center gap-2.5 py-2.5 pr-3 pl-4";

/** A section's shell while its lines load: the heading's name and pill over the rows given. */
export function GroceryLinesSectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <Card>
      <View className={HEADER}>
        <Skeleton className="h-5 w-24 rounded-md" />
        <View className="flex-1" />
        <Skeleton className="h-[34px] w-24 rounded-full" />
      </View>
      {children}
    </Card>
  );
}

/** One section of the Add to groceries sheet: a card whose heading has its name, how many of its
 * lines are ticked and select-all, then its lines. */
export function GroceryLinesSection({
  title,
  count,
  toggleLabel,
  testID,
  onToggleAll,
  children,
}: {
  title: string;
  count: string;
  toggleLabel: string;
  testID: string;
  onToggleAll: () => void;
  children: ReactNode;
}) {
  return (
    <Card testID={testID}>
      <View className={HEADER}>
        {/* The count grows from nothing, so it gives way first; a long title then truncates. */}
        <Text className="text-foreground shrink text-base font-semibold" numberOfLines={1}>
          {title}
        </Text>
        <Text
          className="text-muted min-w-0 flex-1 text-sm"
          numberOfLines={1}
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {count}
        </Text>
        <PillButton label={toggleLabel} testID={`${testID}-toggle`} onPress={onToggleAll} />
      </View>
      {children}
    </Card>
  );
}
