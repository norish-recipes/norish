import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { Button } from "heroui-native";

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
    <View className="bg-surface overflow-hidden rounded-[22px]" testID={testID}>
      <View className="bg-default flex-row items-center gap-2.5 py-2.5 pr-2.5 pl-3.5">
        <Text className="text-foreground text-[15px] font-semibold">{title}</Text>
        <Text className="text-muted flex-1 text-[13px]" numberOfLines={1}>
          {count}
        </Text>
        <Button
          className="bg-surface h-[30px] rounded-full px-3"
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
