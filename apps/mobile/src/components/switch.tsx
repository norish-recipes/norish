import React from "react";
import { Pressable, View } from "react-native";
import { lightImpact } from "@/lib/haptics";

/** The kit's one on/off switch: a recessed sand track with a solid thumb, accent while on. */
export function Switch({
  isSelected,
  accessibilityLabel,
  testID,
  onSelectedChange,
}: {
  isSelected: boolean;
  accessibilityLabel: string;
  testID: string;
  onSelectedChange: (selected: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: isSelected }}
      className={`h-[30px] w-[58px] flex-row rounded-full p-0.5 ${isSelected ? "bg-accent justify-end" : "bg-sand border-stroke justify-start border"}`}
      testID={testID}
      onPress={() => {
        lightImpact();
        onSelectedChange(!isSelected);
      }}
    >
      <View className="h-[26px] w-9 rounded-full bg-white shadow-sm" />
    </Pressable>
  );
}
