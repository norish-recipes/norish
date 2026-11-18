import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { StyleSheet, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { Button, Host, Image, Menu, Rectangle } from "@expo/ui/swift-ui";
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

/** A pill's height and its fully rounded glass radius, so a caller names a size, not a radius. */
const PILL = { regular: { height: "h-11", radius: 22 }, small: { height: "h-[30px]", radius: 15 } };

/** A PressableScale on glass, as a text pill or Today; `className` lays out what is inside it. */
export function GlassPill({
  size = "regular",
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof PressableScale>, "children" | "className"> & {
  size?: keyof typeof PILL;
  className: string;
  children: ReactNode;
}) {
  const { height, radius } = PILL[size];

  return (
    <PressableScale
      accessibilityRole="button"
      className={`${height} rounded-full ${className}`}
      {...props}
    >
      <GlassSurface radius={radius} />
      {children}
    </PressableScale>
  );
}

/** The height of a glass control on a page, so a stepper, a menu and a portion control line up. */
export const GLASS_CONTROL_HEIGHT = 40;

/** What the glass style adds to a label's frame, on each side. */
const GLASS_PADDING = 7;

/** The glyph's frame and size, so the glass pads it out to a circle. */
const SIZES = {
  regular: { frame: GLASS_CONTROL_HEIGHT - 2 * GLASS_PADDING, glyph: 18 },
  /** A 14 pt frame makes the 28 pt circle drawn over a photo. */
  small: { frame: 14, glyph: 12 },
  /** A 58 pt frame makes the 72 pt play button over a video poster. */
  large: { frame: 58, glyph: 28 },
} as const;

const GLASS_CIRCLE = [buttonStyle("glass"), buttonBorderShape("circle")];

function Glyph({
  symbol,
  size,
  color,
}: {
  symbol: ComponentProps<typeof Image>["systemName"];
  size: keyof typeof SIZES;
  color?: "accent-foreground";
}) {
  const [glyphColor] = useThemeColor([color ?? "foreground"] as const);
  const { frame: side, glyph } = SIZES[size];

  return (
    <Image
      color={glyphColor}
      modifiers={[frame({ width: side, height: side })]}
      size={glyph}
      systemName={symbol}
    />
  );
}

/** A native glass circle with one SF Symbol, as a sheet's close or a button over a photo.
 * Without `onPress` it is inert, hidden from accessibility, for a glyph in a row that is the press target. */
export function GlassIconButton({
  symbol,
  label,
  testID,
  size = "regular",
  color,
  onPress,
}: {
  symbol: ComponentProps<typeof Image>["systemName"];
  label?: string;
  testID?: string;
  size?: keyof typeof SIZES;
  /** The glyph's theme colour where the foreground does not read, as on a black viewer. */
  color?: "accent-foreground";
  onPress?: () => void;
}) {
  const button = (
    <Host matchContents>
      <Button
        modifiers={
          label && testID
            ? [...GLASS_CIRCLE, accessibilityLabel(label), accessibilityIdentifier(testID)]
            : GLASS_CIRCLE
        }
        onPress={onPress}
      >
        <Glyph color={color} size={size} symbol={symbol} />
      </Button>
    </Host>
  );

  return onPress ? (
    button
  ) : (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {button}
    </View>
  );
}

/** A glass circle with one SF Symbol that opens a native menu of `children`, as a day's plus. */
export function GlassIconMenu({
  symbol,
  label,
  testID,
  size = "small",
  children,
}: {
  symbol: ComponentProps<typeof Image>["systemName"];
  label: string;
  testID: string;
  size?: keyof typeof SIZES;
  children: ReactNode;
}) {
  return (
    <Host matchContents>
      <Menu
        label={<Glyph size={size} symbol={symbol} />}
        modifiers={[...GLASS_CIRCLE, accessibilityLabel(label), accessibilityIdentifier(testID)]}
      >
        {children}
      </Menu>
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
