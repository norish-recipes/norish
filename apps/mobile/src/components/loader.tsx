import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** The app's one loader, the native activity indicator, in the slot the caller gives it (a
 * button's pending state, a row's end); `centred` fills its parent and sits in the middle. */
export function Loader({
  centred = false,
  size = "small",
  color,
  label,
  className,
  testID,
}: {
  centred?: boolean;
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

  if (!centred) return indicator;

  return (
    <View className={`min-h-12 flex-1 items-center justify-center ${className ?? ""}`.trim()}>
      {indicator}
    </View>
  );
}
