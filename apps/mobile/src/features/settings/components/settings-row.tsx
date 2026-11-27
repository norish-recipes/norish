import type { ComponentProps, ReactElement, ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@/components/icon";
import { NativeMenu } from "@/components/native-menu";
import { spokenLabel } from "@/lib/spoken-label";
import { useThemeColor } from "heroui-native";

import { useConnectivity } from "@norish/shared-react/offline/react";

import type { SettingsRowAction } from "../utils/row-actions";
import { actionLook, menuActions, writeBlocked } from "../utils/row-actions";
import { useActionTone } from "./use-action-tone";

type IconName = ComponentProps<typeof Ionicons>["name"];

const ACCESSORY_ICONS = {
  chevron: "chevron-forward",
  expand: "chevron-expand",
  external: "arrow-up",
} as const satisfies Record<string, IconName>;

/** One settings list row: icon tile, title, subtitle, muted value and accessory. `actions` make
 * a long-press menu; Offline turns it off, and a `write` row's own press. */
export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  accessory = "none",
  leading,
  trailing,
  actions = [],
  menuLabel,
  danger = false,
  centred = false,
  write = false,
  wholeValue = false,
  testID,
  onPress,
}: {
  /** An Ionicons name, or a node drawn inside the same tile, such as a provider icon. */
  icon?: IconName | ReactElement;
  title: string;
  subtitle?: string;
  value?: string;
  accessory?: "chevron" | "expand" | "external" | "none";
  /** Replaces the icon tile, such as an avatar or a thumbnail. */
  leading?: ReactNode;
  trailing?: ReactNode;
  actions?: SettingsRowAction[];
  /** The long-press menu's accessibility label. */
  menuLabel?: string;
  danger?: boolean;
  centred?: boolean;
  /** The press is a write: Offline the row dims and ignores it. Navigation rows stay live. */
  write?: boolean;
  /** The value wraps instead of ellipsizing, and the title stays whole, such as a version. */
  wholeValue?: boolean;
  testID: string;
  onPress?: () => void;
}) {
  const { isOffline } = useConnectivity();
  const [foreground, muted, dangerInk] = useThemeColor(["foreground", "muted", "danger"] as const);
  const toneOf = useActionTone();
  const blocked = writeBlocked(write, isOffline);
  const menu = menuActions(actions, isOffline);
  const inkClass = danger ? "text-danger" : "text-foreground";

  const glyph = (size: number) =>
    typeof icon === "string" ? (
      <Ionicons color={danger ? dangerInk : foreground} name={icon} size={size} />
    ) : (
      icon
    );

  const body = (
    <View
      className={`min-h-[50px] flex-row items-center gap-3 px-4 ${centred ? "justify-center" : ""} ${subtitle ? "min-h-16 py-2" : ""} ${blocked ? "opacity-40" : ""}`}
      pointerEvents={blocked ? "none" : "auto"}
    >
      {leading ??
        (icon ? (
          centred ? (
            glyph(20)
          ) : (
            <View className="bg-default size-[30px] items-center justify-center rounded-[9px]">
              {glyph(17)}
            </View>
          )
        ) : null)}
      <View className={centred ? "" : wholeValue ? "shrink-0 gap-0.5" : "min-w-0 flex-1 gap-0.5"}>
        <Text className={`${inkClass} text-base ${centred ? "font-medium" : ""}`} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-muted text-sm" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          className={`text-muted text-base ${wholeValue ? "flex-1 text-right" : "max-w-[55%]"}`}
          numberOfLines={wholeValue ? undefined : 1}
        >
          {value}
        </Text>
      ) : null}
      {trailing}
      {accessory === "none" ? null : (
        <Ionicons
          color={muted}
          name={ACCESSORY_ICONS[accessory]}
          size={16}
          style={accessory === "external" ? { transform: [{ rotate: "45deg" }] } : undefined}
        />
      )}
    </View>
  );

  // A long-press menu takes the taps too, so the press goes through it; no items, no menu.
  const pressable =
    menu.length > 0 ? (
      <NativeMenu
        items={menu.map((action) => {
          const look = actionLook(action.kind);
          const tone = toneOf(look.tone);

          return {
            key: action.kind,
            label: action.label,
            systemImage: look.symbol,
            destructive: tone.destructive,
            tint: tone.tint,
            onPress: action.onPress,
          };
        })}
        label={menuLabel ?? title}
        testID={testID}
        // The menu hides what the row draws, so VoiceOver hears the rest of it as the value.
        value={spokenLabel(subtitle, value) || undefined}
        onPress={() => onPress?.()}
      >
        {/* Opaque, as the long press lifts a snapshot of it: the whole row, not its glyphs alone. */}
        <View className="bg-surface">{body}</View>
      </NativeMenu>
    ) : onPress ? (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: blocked }}
        className="active:bg-default"
        disabled={blocked}
        testID={testID}
        onPress={onPress}
      >
        {body}
      </Pressable>
    ) : (
      <View testID={testID}>{body}</View>
    );

  // The hairline above the row, which SettingsGroup clips on its first row.
  const hairline = <View className="bg-line ml-[58px] h-px" />;

  return (
    <>
      {hairline}
      {pressable}
    </>
  );
}
