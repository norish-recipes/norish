import type { ReactNode } from "react";
import React from "react";
import { Pressable, View } from "react-native";
import { GlassSurface } from "@/components/glass";
import { lightImpact } from "@/lib/haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

const HEIGHT = 40;

function Step({
  icon,
  label,
  testID,
  onPress,
}: {
  icon: "add" | "remove";
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const [foreground] = useThemeColor(["foreground"] as const);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="items-center justify-center"
      style={{ width: HEIGHT, height: HEIGHT }}
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
 * steps' (`-decrease`, `-increase`). The value's press, if any, is the caller's own. */
export function GlassStepper({
  children,
  decreaseLabelId,
  increaseLabelId,
  testID,
  onDecrement,
  onIncrement,
}: {
  children: ReactNode;
  decreaseLabelId: string;
  increaseLabelId: string;
  testID: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const intl = useIntl();

  return (
    <View className="flex-row items-center rounded-full" style={{ height: HEIGHT }}>
      <GlassSurface radius={HEIGHT / 2} />
      <Step
        icon="remove"
        label={intl.formatMessage({ id: decreaseLabelId })}
        testID={`${testID}-decrease`}
        onPress={onDecrement}
      />
      {children}
      <Step
        icon="add"
        label={intl.formatMessage({ id: increaseLabelId })}
        testID={`${testID}-increase`}
        onPress={onIncrement}
      />
    </View>
  );
}
