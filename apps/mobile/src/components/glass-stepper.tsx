import type { ReactNode } from "react";
import React from "react";
import { Pressable, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { lightImpact } from "@/lib/haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

const HEIGHT = 40;

function Step({
  icon,
  label,
  testID,
  disabled,
  onPress,
}: {
  icon: "add" | "remove";
  label: string;
  testID: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const [foreground] = useThemeColor(["foreground"] as const);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className="items-center justify-center"
      disabled={disabled}
      style={{ width: HEIGHT, height: HEIGHT, opacity: disabled ? 0.35 : 1 }}
      testID={testID}
      onPress={() => {
        lightImpact();
        onPress();
      }}
    >
      <Ionicons color={foreground} name={icon} size={17} />
    </Pressable>
  );
}

/** A minus and a plus in one glass capsule around `children`, the value; `testID` prefixes the
 * steps' (`-decrease`, `-increase`). A step that cannot move is disabled, so it gives no haptic.
 * The value's press, if any, is the caller's own. */
export function GlassStepper({
  children,
  decreaseLabel,
  increaseLabel,
  canDecrement = true,
  canIncrement = true,
  testID,
  onDecrement,
  onIncrement,
}: {
  children: ReactNode;
  decreaseLabel: string;
  increaseLabel: string;
  canDecrement?: boolean;
  canIncrement?: boolean;
  testID: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View className="flex-row items-center rounded-full" style={{ height: HEIGHT }}>
      <GlassSurface radius={HEIGHT / 2} />
      <Step
        icon="remove"
        disabled={!canDecrement}
        label={decreaseLabel}
        testID={`${testID}-decrease`}
        onPress={onDecrement}
      />
      {children}
      <Step
        icon="add"
        disabled={!canIncrement}
        label={increaseLabel}
        testID={`${testID}-increase`}
        onPress={onIncrement}
      />
    </View>
  );
}
