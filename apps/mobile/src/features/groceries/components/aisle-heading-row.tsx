import React from "react";
import { Text, View } from "react-native";

/** An Aisle's heading inside a Store's block, where its groceries are found. */
export function AisleHeadingRow({ name, count }: { name: string; count: number }) {
  return (
    <View className="px-4 pt-3.5 pb-1.5" testID="aisle-heading">
      <Text className="text-muted text-xs font-semibold tracking-[0.6px] uppercase">
        {name} <Text className="font-medium">{count}</Text>
      </Text>
    </View>
  );
}
