import type { ToastComponentProps } from "heroui-native";
import type { ComponentProps } from "react";
import React, { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Host, Rectangle } from "@expo/ui/swift-ui";
import { foregroundStyle, glassEffect } from "@expo/ui/swift-ui/modifiers";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Toast, useThemeColor } from "heroui-native";
import { useCSSVariable } from "uniwind";

export type ToastSeverity = "default" | "success" | "warning" | "danger";

/** The icon circle per severity, as the board draws imported (accent) and failed (danger-soft). */
const BADGE: Record<
  ToastSeverity,
  { icon: ComponentProps<typeof Ionicons>["name"]; circle: string; color: string }
> = {
  default: { icon: "information", circle: "bg-accent-soft", color: "--color-accent-text" },
  success: { icon: "checkmark", circle: "bg-accent", color: "--color-accent-foreground" },
  warning: {
    icon: "alert-circle-outline",
    circle: "bg-warning-soft",
    color: "--color-warning-ink",
  },
  danger: { icon: "alert-circle-outline", circle: "bg-danger-soft", color: "--color-danger" },
};

/** The native glass behind the pill: a clear rectangle with the system's glass in the toast's shape. */
const glass = (
  <Host pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Rectangle
      modifiers={[
        foregroundStyle("#00000000"),
        glassEffect({ glass: { variant: "regular" }, shape: "roundedRectangle", cornerRadius: 32 }),
      ]}
    />
  </Host>
);

/** Every toast of the app: a glass pill with the severity's circle, title, optional body and action. */
export function GlassToast({
  severity,
  title,
  body,
  actionLabel,
  onAction,
  ...props
}: ToastComponentProps & {
  severity: ToastSeverity;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const badge = BADGE[severity];
  const iconColor = useCSSVariable(badge.color);
  const [foreground] = useThemeColor(["foreground"] as const);
  const pressedRef = useRef(false);

  return (
    <Toast
      {...props}
      background={glass}
      className="min-h-16 flex-row items-center gap-3 rounded-[32px] bg-transparent py-2.5 pr-2.5 pl-3 shadow-none"
      testID="toast"
    >
      <View className={`size-10 items-center justify-center rounded-full ${badge.circle}`}>
        <Ionicons
          color={typeof iconColor === "string" ? iconColor : foreground}
          name={badge.icon}
          size={20}
        />
      </View>
      <View
        accessible
        accessibilityLabel={body ? `${title}, ${body}` : title}
        accessibilityRole="alert"
        className="min-w-0 flex-1 gap-px"
      >
        <Text className="text-foreground text-[15px] font-semibold">{title}</Text>
        {body ? <Text className="text-muted text-sm leading-[19px]">{body}</Text> : null}
      </View>
      {actionLabel ? (
        <Button
          accessibilityLabel={actionLabel}
          className="bg-accent-soft h-10 rounded-full px-[18px]"
          testID="toast-action"
          variant="ghost"
          onPress={() => {
            if (pressedRef.current) return;
            pressedRef.current = true;
            props.hide();
            onAction?.();
          }}
        >
          <Button.Label className="text-accent-text text-[15px] font-semibold">
            {actionLabel}
          </Button.Label>
        </Button>
      ) : null}
    </Toast>
  );
}
