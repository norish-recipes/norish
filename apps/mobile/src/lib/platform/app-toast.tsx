import type { ToastComponentProps } from "heroui-native";
import type { ComponentProps } from "react";
import React, { useRef } from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Toast, useThemeColor } from "heroui-native";
import { useCSSVariable } from "uniwind";

export type ToastSeverity = "default" | "success" | "warning" | "danger";

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

/** Every toast of the app: a pill with the severity's circle, title, optional body and action. */
export function AppToast({
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
      // ponytail: opaque overlay, as heroui's glass theme forces; native glass drew nothing in the toast window.
      background={null}
      className="bg-overlay min-h-16 flex-row items-center gap-3 rounded-[32px] py-2.5 pr-2.5 pl-5"
      testID="toast"
    >
      <View className={`size-6 items-center justify-center rounded-full ${badge.circle}`}>
        <Ionicons
          color={typeof iconColor === "string" ? iconColor : foreground}
          name={badge.icon}
          size={14}
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
