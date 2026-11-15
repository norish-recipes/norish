import React from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

/** The small (i) beside a label or title: its hint opens in an alert. */
export function HintButton({
  hint,
  title,
  size = 18,
  className,
  testID,
}: {
  hint: string;
  title?: string;
  size?: number;
  className?: string;
  testID?: string;
}) {
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <Pressable
      accessibilityLabel={hint}
      accessibilityRole="button"
      className={className}
      hitSlop={10}
      testID={testID}
      onPress={() => Alert.alert(title ?? hint, title ? hint : undefined)}
    >
      <Ionicons color={muted} name="information-circle-outline" size={size} />
    </Pressable>
  );
}

/** A form field's label, with its explanation behind a hint button where it needs one. */
export function LabelWithHint({
  label,
  hint,
  testID,
}: {
  label: string;
  hint?: string;
  testID?: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5 px-2 pb-2">
      <Text className="text-muted text-[13px] font-medium">{label}</Text>
      {hint ? <HintButton hint={hint} size={16} testID={testID} /> : null}
    </View>
  );
}
