import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { Card } from "@/components/card";
import { PillButton } from "@/components/pill-button";
import { SectionLabel } from "@/components/section-label";
import { Skeleton } from "heroui-native";

/** A section's label row: its name beside the pill, above the card of lines. */
const HEADER = "flex-row items-end justify-between gap-2 px-2";

/** A section's shell while its lines load: the label's name and pill over the rows given. */
export function GroceryLinesSectionSkeleton({ children }: { children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <View className={HEADER}>
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-[34px] w-24 rounded-full" />
      </View>
      <Card>{children}</Card>
    </View>
  );
}

/** One section of the Add to groceries sheet: its name and select-all, then a card of its lines. */
export function GroceryLinesSection({
  title,
  toggleLabel,
  testID,
  onToggleAll,
  children,
}: {
  title: string;
  toggleLabel: string;
  testID: string;
  onToggleAll: () => void;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5" testID={testID}>
      <View className={HEADER}>
        <SectionLabel className="pb-1.5">{title}</SectionLabel>
        <PillButton label={toggleLabel} testID={`${testID}-toggle`} onPress={onToggleAll} />
      </View>
      <Card>{children}</Card>
    </View>
  );
}
