import type { ComponentProps, ReactNode } from "react";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import React, { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { NativeMenu } from "@/components/native-menu";
import { closeOpenRow, useOpenRow } from "@/lib/open-row";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

import { useConnectivity } from "@norish/shared-react/offline/react";

import type { SettingsRowAction } from "../utils/row-actions";
import { actionLook, menuActions, swipeActions, writeBlocked } from "../utils/row-actions";
import { SwipeActionsPanel } from "./swipe-actions-panel";
import { useActionTone } from "./use-action-tone";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** One settings list row: an optional icon tile, a title (and subtitle), a muted value and a
 * chevron or external arrow. `actions` become swipe circles (34 pt, 11 pt labels) and a long-press
 * glass menu; both are off while Offline, and so is a `write` row's own press. */
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
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  accessory?: "chevron" | "external" | "none";
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
  /** The value shrinks nothing, instead of ellipsizing, such as a version. */
  wholeValue?: boolean;
  testID: string;
  onPress?: () => void;
}) {
  const { isOffline } = useConnectivity();
  const rowRef = useRef<SwipeableMethods>(null);
  const openRow = useOpenRow(rowRef);
  const width = useSharedValue(0);
  const translation = useSharedValue(0);
  const [foreground, muted, dangerInk] = useThemeColor(["foreground", "muted", "danger"] as const);
  const toneOf = useActionTone();
  const blocked = writeBlocked(write, isOffline);
  const swipes = swipeActions(actions);
  const menu = menuActions(actions, isOffline);
  const inkClass = danger ? "text-danger" : "text-foreground";
  const slide = useAnimatedStyle(() => ({
    width: width.get() > 0 ? width.get() + translation.get() : undefined,
    transform: [{ translateX: -translation.get() }],
  }));

  const body = (
    <View
      className={`min-h-[50px] flex-row items-center gap-3 px-4 ${centred ? "justify-center" : ""} ${subtitle ? "min-h-16 py-2" : ""} ${blocked ? "opacity-40" : ""}`}
      pointerEvents={blocked ? "none" : "auto"}
    >
      {leading ??
        (icon ? (
          centred ? (
            <Ionicons color={danger ? dangerInk : foreground} name={icon} size={20} />
          ) : (
            <View className="bg-default size-[30px] items-center justify-center rounded-[9px]">
              <Ionicons color={danger ? dangerInk : foreground} name={icon} size={17} />
            </View>
          )
        ) : null)}
      <View className={centred ? "" : "min-w-0 flex-1 gap-0.5"}>
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
          className={`text-muted text-base ${wholeValue ? "shrink-0" : "max-w-[55%]"}`}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      {trailing}
      {accessory === "none" ? null : (
        <Ionicons
          color={muted}
          name={accessory === "chevron" ? "chevron-forward" : "arrow-up"}
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
        onPress={() => onPress?.()}
      >
        {body}
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

  if (swipes.length === 0) return pressable;

  return (
    <View
      onLayout={(event) => width.set(event.nativeEvent.layout.width)}
      onTouchStart={(event) => {
        event.stopPropagation();
        closeOpenRow(openRow.row);
      }}
    >
      <ReanimatedSwipeable
        ref={rowRef}
        enabled={!isOffline}
        overshootRight={false}
        renderRightActions={(_progress, swipeTranslation, methods) => (
          <>
            <TranslationSync from={swipeTranslation} to={translation} />
            <SwipeActionsPanel actions={swipes} enabled={!isOffline} methods={methods} />
          </>
        )}
        rightThreshold={40}
        onSwipeableClose={openRow.closed}
        onSwipeableWillOpen={openRow.opened}
      >
        <Animated.View style={slide}>{pressable}</Animated.View>
      </ReanimatedSwipeable>
    </View>
  );
}

/** Copies the swipe's translation onto the row's own value, where its content shrinks by it. */
function TranslationSync({ from, to }: { from: SharedValue<number>; to: SharedValue<number> }) {
  useAnimatedReaction(
    () => from.get(),
    (value) => to.set(value)
  );

  return null;
}
