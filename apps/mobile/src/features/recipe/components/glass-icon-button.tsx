import type { ComponentProps } from "react";
import React from "react";
import { Button, Host, Image } from "@expo/ui/swift-ui";
import {
  accessibilityIdentifier,
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  frame,
} from "@expo/ui/swift-ui/modifiers";
import { useThemeColor } from "heroui-native";

/** A native glass circle over a photo with one SF Symbol; the same 40 pt circle as a sheet's close. */
export function GlassIconButton({
  symbol,
  label,
  testID,
  onPress,
}: {
  symbol: ComponentProps<typeof Image>["systemName"];
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const [foreground] = useThemeColor(["foreground"] as const);

  return (
    <Host matchContents>
      <Button
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("circle"),
          accessibilityLabel(label),
          accessibilityIdentifier(testID),
        ]}
        onPress={onPress}
      >
        <Image
          color={foreground}
          modifiers={[frame({ width: 26, height: 26 })]}
          size={18}
          systemName={symbol}
        />
      </Button>
    </Host>
  );
}
