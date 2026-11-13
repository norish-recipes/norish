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
import { useIntl } from "react-intl";

/** The sheet's close button: a native glass circle, 40 pt as the board draws it. */
export function GlassCloseButton({ onPress, testID }: { onPress: () => void; testID: string }) {
  const intl = useIntl();
  const [foreground] = useThemeColor(["foreground"] as const);

  return (
    <Host matchContents>
      <Button
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("circle"),
          accessibilityLabel(intl.formatMessage({ id: "common.actions.close" })),
          accessibilityIdentifier(testID),
        ]}
        onPress={onPress}
      >
        {/* The glass style pads the label 7 pt on each side, so 26 pt makes the board's 40 pt circle. */}
        <Image
          color={foreground}
          modifiers={[frame({ width: 26, height: 26 })]}
          size={18}
          systemName="xmark"
        />
      </Button>
    </Host>
  );
}
