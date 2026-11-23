import type Ionicons from "@expo/vector-icons/Ionicons";
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
import { PressableScale } from "@/components/pressable-scale";
import { useTokenColor } from "@/hooks/use-token-color";
import { closeOpenRow, useOpenRow } from "@/lib/open-row";
import VectorIcon from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

import { useConnectivity } from "@norish/shared-react/offline/react";

import type { ActionTone, SettingsRowAction } from "../utils/row-actions";
import { actionLook, actionsEnabled, menuActions, swipeActions } from "../utils/row-actions";

type IconName = ComponentProps<typeof Ionicons>["name"];

// A swipe circle is 34 pt under a 11 pt label, in a 52 pt slot.
const SLOT = 52;
const CIRCLE = 34;
const CIRCLE_GROUND: Record<ActionTone, string> = {
  danger: "bg-danger",
  shop: "bg-shop",
  accent: "bg-accent",
  plain: "bg-default",
};
const HEX = /^#[0-9a-f]{6}$/i;

function SwipePanel({
  actions,
  enabled,
  methods,
}: {
  actions: SettingsRowAction[];
  enabled: boolean;
  methods: SwipeableMethods;
}) {
  const [danger, accent] = useThemeColor(["danger-foreground", "accent-foreground"] as const);
  const shopInk = useTokenColor("shop-foreground");
  const ink = (tone: ActionTone) =>
    tone === "accent" ? accent : tone === "shop" && shopInk ? shopInk : danger;

  return (
    <View
      className="flex-row items-center justify-end pl-1"
      style={{ width: SLOT * actions.length + 4, opacity: enabled ? 1 : 0.4 }}
    >
      {actions.map((action) => {
        const look = actionLook(action.kind);

        return (
          <PressableScale
            key={action.kind}
            accessibilityLabel={action.label}
            accessibilityRole="button"
            accessibilityState={{ disabled: !enabled }}
            className="w-[52px] items-center gap-[3px]"
            disabled={!enabled}
            testID={`settings-action-${action.kind}`}
            onPress={() => {
              methods.close();
              action.onPress();
            }}
          >
            <View
              className={`items-center justify-center rounded-full ${CIRCLE_GROUND[look.tone]}`}
              style={{ width: CIRCLE, height: CIRCLE }}
            >
              <VectorIcon color={ink(look.tone)} name={look.icon} size={16} />
            </View>
            <Text
              className="text-muted w-full text-center text-[11px] font-medium"
              ellipsizeMode="tail"
              numberOfLines={1}
            >
              {action.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** One settings list row: an optional icon tile, a title (and subtitle), a muted value and a
 * chevron or external arrow. `actions` become swipe circles (34 pt, 11 pt labels) and a long-press
 * glass menu; both are off while Offline. */
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
  testID: string;
  onPress?: () => void;
}) {
  const { isOffline } = useConnectivity();
  const rowRef = useRef<SwipeableMethods>(null);
  const openRow = useOpenRow(rowRef);
  const width = useSharedValue(0);
  const translation = useSharedValue(0);
  const [foreground, muted, dangerInk, accent, shop] = useThemeColor([
    "foreground",
    "muted",
    "danger",
    "accent",
    "warning",
  ] as const);
  const shopColour = useTokenColor("shop");
  const swipes = swipeActions(actions);
  const menu = menuActions(actions, isOffline);
  const inkClass = danger ? "text-danger" : "text-foreground";
  const hex = (colour: string | undefined) => (colour && HEX.test(colour) ? colour : undefined);
  const tints: Record<ActionTone, string | undefined> = {
    danger: hex(dangerInk),
    shop: hex(shopColour) ?? hex(shop),
    accent: hex(accent),
    plain: hex(foreground),
  };
  const slide = useAnimatedStyle(() => ({
    width: width.get() > 0 ? width.get() + translation.get() : undefined,
    transform: [{ translateX: -translation.get() }],
  }));

  const body = (
    <View
      className={`min-h-[50px] flex-row items-center gap-3 px-4 ${centred ? "justify-center" : ""} ${subtitle ? "min-h-16 py-2" : ""}`}
    >
      {leading ??
        (icon ? (
          centred ? (
            <VectorIcon color={danger ? dangerInk : foreground} name={icon} size={20} />
          ) : (
            <View className="bg-default size-[30px] items-center justify-center rounded-[9px]">
              <VectorIcon color={danger ? dangerInk : foreground} name={icon} size={17} />
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
        <Text className="text-muted max-w-[55%] text-base" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {accessory === "none" ? null : (
        <VectorIcon
          color={muted}
          name={accessory === "chevron" ? "chevron-forward" : "arrow-up"}
          size={16}
          style={accessory === "external" ? { transform: [{ rotate: "45deg" }] } : undefined}
        />
      )}
    </View>
  );

  // A long-press menu takes the taps too, so the press goes through it.
  const pressable =
    actions.length > 0 ? (
      <NativeMenu
        items={menu.map((action) => {
          const look = actionLook(action.kind);

          return {
            key: action.kind,
            label: action.label,
            systemImage: look.symbol,
            destructive: look.tone === "danger",
            tint: tints[look.tone],
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
        className="active:bg-default"
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
        enabled={actionsEnabled(isOffline)}
        overshootRight={false}
        renderRightActions={(_progress, swipeTranslation, methods) => (
          <>
            <TranslationSync from={swipeTranslation} to={translation} />
            <SwipePanel actions={swipes} enabled={actionsEnabled(isOffline)} methods={methods} />
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
