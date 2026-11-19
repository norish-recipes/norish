import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { Card } from "@/components/card";
import { PillButton } from "@/components/pill-button";
import { Skeleton } from "heroui-native";

const HEADER = "flex-row items-center gap-2.5 py-2.5 pr-2.5 pl-3.5";

/** A section's shell while its lines load: the header's name and button over the rows given. */
export function GroceryLinesSectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <Card>
      <View className={HEADER}>
        <Skeleton className="h-5 w-24 rounded-md" />
        <View className="flex-1" />
        <Skeleton className="h-[30px] w-20 rounded-full" />
      </View>
      {children}
    </Card>
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
    <Card testID={testID}>
      <View className={HEADER}>
        <Text className="text-foreground text-[15px] font-semibold">{title}</Text>
        <Text className="text-muted flex-1 text-[13px]" numberOfLines={1}>
          {count}
        </Text>
        <PillButton label={toggleLabel} testID={`${testID}-toggle`} onPress={onToggleAll} />
      </View>
      {children}
    </Card>
  );
}
