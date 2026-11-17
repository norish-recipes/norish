import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/**
 * The app's one loader, the native activity indicator. It centres itself in the space it is given;
 * `inline` leaves it to the caller (a button's own pending state, a row's trailing slot).
 */
export function Loader({
  inline = false,
  size = "small",
  color,
  label,
  className,
  testID,
}: {
  inline?: boolean;
  size?: "small" | "large";
  /** The theme's muted tone unless the loader sits on a filled surface. */
  color?: string;
  /** What is loading, for VoiceOver; "Loading" otherwise. */
  label?: string;
  className?: string;
  testID?: string;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);
  const indicator = (
    <ActivityIndicator
      accessibilityLabel={label ?? intl.formatMessage({ id: "common.loading" })}
      color={color ?? muted}
      size={size}
      testID={testID}
    />
  );

  if (inline) return indicator;

  return (
    <View className={`min-h-12 flex-1 items-center justify-center ${className ?? ""}`}>
      {indicator}
    </View>
  );
}
