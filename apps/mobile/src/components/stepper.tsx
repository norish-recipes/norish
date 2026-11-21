import type { ReactNode } from "react";
import React from "react";
import { Pressable, View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import { lightImpact } from "@/lib/haptics";
import Ionicons from "@expo/vector-icons/Ionicons";

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
  const foreground = useTokenColor("foreground");

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

/** The kit's stepper: solid knobs on a sand track around `children`, the value; `wide` fills the
 * row. `testID` prefixes the knobs' `-decrease` and `-increase`; a knob that cannot move is disabled. */
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
