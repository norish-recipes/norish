import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { Button, Skeleton } from "heroui-native";

const SECTION = "bg-default overflow-hidden rounded-[22px]";
const HEADER = "bg-surface flex-row items-center gap-2.5 py-2.5 pr-2.5 pl-3.5";

/** A section's shell while its lines load: the header's name and button over the rows given. */
export function GroceryLinesSectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <View className={SECTION}>
      <View className={HEADER}>
        <Skeleton className="h-5 w-24 rounded-md" />
        <View className="flex-1" />
        <Skeleton className="h-[30px] w-20 rounded-full" />
      </View>
      {children}
    </View>
  );
}

/** One section of the Add to groceries sheet: its name, how many lines are ticked, select-all, then its lines. */
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
    <View className={SECTION} testID={testID}>
      <View className={HEADER}>
        <Text className="text-foreground text-[15px] font-semibold">{title}</Text>
        <Text className="text-muted flex-1 text-[13px]" numberOfLines={1}>
          {count}
        </Text>
        <Button
          className="bg-default h-[30px] rounded-full px-3"
          size="sm"
          testID={`${testID}-toggle`}
          variant="secondary"
          onPress={onToggleAll}
        >
          <Button.Label className="text-foreground text-[13px] font-medium">
            {toggleLabel}
          </Button.Label>
        </Button>
      </View>
      {children}
    </View>
  );
}
