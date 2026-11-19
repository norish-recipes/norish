import type { ReactNode } from "react";
import React from "react";
import { Pressable, View } from "react-native";
import { lightImpact } from "@/lib/haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

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
      className={`bg-thumb size-9 items-center justify-center rounded-full shadow-sm ${disabled ? "opacity-40" : ""}`}
      disabled={disabled}
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

/** The kit's one stepper: a minus and a plus as solid knobs on a sand track around `children`, the
 * value; `wide` stretches it to its row. `testID` prefixes the knobs' (`-decrease`, `-increase`);
 * a knob that cannot move is disabled, so gives no haptic. */
export function Stepper({
  children,
  decreaseLabel,
  increaseLabel,
  canDecrement = true,
  canIncrement = true,
  wide = false,
  testID,
  onDecrement,
  onIncrement,
}: {
  children: ReactNode;
  decreaseLabel: string;
  increaseLabel: string;
  canDecrement?: boolean;
  canIncrement?: boolean;
  wide?: boolean;
  testID: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View
      className={`bg-sand border-stroke h-11 flex-row items-center gap-1 rounded-full border-[0.5px] px-1 ${wide ? "w-full justify-between" : "self-start"}`}
    >
      <Step
        disabled={!canDecrement}
        icon="remove"
        label={decreaseLabel}
        testID={`${testID}-decrease`}
        onPress={onDecrement}
      />
      {children}
      <Step
        disabled={!canIncrement}
        icon="add"
        label={increaseLabel}
        testID={`${testID}-increase`}
        onPress={onIncrement}
      />
    </View>
  );
}
