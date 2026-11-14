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

/** The glyph's frame and size: the glass style pads the label 7 pt on each side. */
const SIZES = {
  /** The glass pads a 26 pt frame to a 40 pt circle. */
  regular: { frame: 26, glyph: 18 },
  /** A 14 pt frame makes the 28 pt circle drawn over a photo. */
  small: { frame: 14, glyph: 12 },
} as const;

/** A native glass circle with an ×: the sheet's close button, or a small one that removes a photo. */
export function GlassCloseButton({
  onPress,
  testID,
  label,
  size = "regular",
}: {
  onPress: () => void;
  testID: string;
  /** What VoiceOver reads; Close by default. */
  label?: string;
  size?: keyof typeof SIZES;
}) {
  const intl = useIntl();
  const [foreground] = useThemeColor(["foreground"] as const);
  const { frame: side, glyph } = SIZES[size];

  return (
    <Host matchContents>
      <Button
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("circle"),
          accessibilityLabel(label ?? intl.formatMessage({ id: "common.actions.close" })),
          accessibilityIdentifier(testID),
        ]}
        onPress={onPress}
      >
        <Image
          color={foreground}
          modifiers={[frame({ width: side, height: side })]}
          size={glyph}
          systemName="xmark"
        />
      </Button>
    </Host>
  );
}
