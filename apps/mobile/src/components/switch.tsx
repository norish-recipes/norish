import React from "react";
import { Pressable, View } from "react-native";
import { lightImpact } from "@/lib/haptics";

/** The kit's one on/off switch: a recessed sand track with a solid thumb, accent while on. */
export function Switch({
  isSelected,
  accessibilityLabel,
  disabled = false,
  testID,
  onSelectedChange,
}: {
  isSelected: boolean;
  accessibilityLabel: string;
  disabled?: boolean;
  testID: string;
  onSelectedChange: (selected: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: isSelected, disabled }}
      className={`${disabled ? "opacity-50" : ""} h-[30px] w-[58px] flex-row rounded-full p-0.5 ${isSelected ? "bg-accent justify-end" : "bg-sand border-stroke justify-start border"}`}
      disabled={disabled}
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
