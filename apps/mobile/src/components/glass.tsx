import type { ComponentProps } from "react";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Host, Image, Rectangle } from "@expo/ui/swift-ui";
import {
  accessibilityIdentifier,
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  foregroundStyle,
  frame,
  glassEffect,
} from "@expo/ui/swift-ui/modifiers";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** Native Liquid Glass behind React Native controls, laid first in a floating control; `tint` colours it. */
export function GlassSurface({ radius, tint }: { radius: number; tint?: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Host style={StyleSheet.absoluteFill}>
        <Rectangle
          modifiers={[
            foregroundStyle("#00000000"),
            glassEffect({
              glass: { variant: "regular", tint },
              shape: "roundedRectangle",
              cornerRadius: radius,
            }),
          ]}
        />
      </Host>
    </View>
  );
}

/** The glyph's frame and size: the glass style pads the label 7 pt on each side. */
const SIZES = {
  /** The glass pads a 26 pt frame to a 40 pt circle. */
  regular: { frame: 26, glyph: 18 },
  /** A 14 pt frame makes the 28 pt circle drawn over a photo. */
  small: { frame: 14, glyph: 12 },
} as const;

/** A native glass circle with one SF Symbol, as a sheet's close or a button over a photo. */
export function GlassIconButton({
  symbol,
  label,
  testID,
  size = "regular",
  color,
  onPress,
}: {
  symbol: ComponentProps<typeof Image>["systemName"];
  label: string;
  testID: string;
  size?: keyof typeof SIZES;
  /** The glyph's theme colour where the foreground does not read, as on a black viewer. */
  color?: "accent-foreground";
  onPress: () => void;
}) {
  const [glyphColor] = useThemeColor([color ?? "foreground"] as const);
  const { frame: side, glyph } = SIZES[size];

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
          color={glyphColor}
          modifiers={[frame({ width: side, height: side })]}
          size={glyph}
          systemName={symbol}
        />
      </Button>
    </Host>
  );
}

/** The glass × that closes a sheet or cook mode, or a small one that removes a photo; Close by default. */
export function GlassCloseButton({
  label,
  ...props
}: Omit<ComponentProps<typeof GlassIconButton>, "symbol" | "label"> & { label?: string }) {
  const intl = useIntl();

  return (
    <GlassIconButton
      {...props}
      label={label ?? intl.formatMessage({ id: "common.actions.close" })}
      symbol="xmark"
    />
  );
}
