import type { ComponentProps, ReactNode } from "react";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import React, { use, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useCSSVariable } from "uniwind";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

import type { RecipeSwipeAction } from "../utils/card-actions";
import { RevealRowContext } from "./card-list";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type SwipeAction = {
  key: RecipeSwipeAction;
  label: string;
  onPress: () => void;
  testID: string;
};

const ICONS: Record<SwipeAction["key"], IconName> = {
  groceries: "bag-outline",
  plan: "calendar-clear-outline",
  delete: "trash-outline",
};
const GROUND: Record<SwipeAction["key"], string> = {
  groceries: "bg-shop",
  plan: "bg-plan",
  delete: "bg-danger",
};

// List circles are 48 pt in a 208 pt panel, grid circles 44 pt in an 80 pt one; the card stops
// 8 / 4 pt short of the panel.
const LIST_BUTTON = 208 / 3;
const LIST_GAP = 8;
const GRID_PANEL = 80;
const GRID_GAP = 4;

// A CSS `0 2px 8px` shadow at 14% black; iOS's radius is half the CSS blur.
const CIRCLE_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.14,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
};

// Module scope: one card is open at a time, and the tRPC remount must not strand a stale ref.
let openRow: SwipeableMethods | null = null;

/** The card's swipe-left actions: coloured circles on the page with a neutral label under each. */
export function SwipeActions({
  variant,
  actions,
  children,
}: {
  variant: RecipeViewMode;
  actions: SwipeAction[];
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rowRef = useRef<SwipeableMethods>(null);
  const revealRow = use(RevealRowContext);
  const isGrid = variant === "grid";
  const width = isGrid ? GRID_PANEL + GRID_GAP : LIST_GAP + LIST_BUTTON * actions.length;

  return (
    <ReanimatedSwipeable
      ref={rowRef}
      containerStyle={isGrid ? { flex: 1, borderRadius: 24 } : undefined}
      overshootRight={false}
      renderRightActions={(progress, _translation, methods) => (
        <ActionsPanel
          actions={actions}
          isGrid={isGrid}
          isOpen={isOpen}
          methods={methods}
          progress={progress}
          width={width}
        />
      )}
      rightThreshold={40}
      onSwipeableClose={() => {
        setIsOpen(false);
        if (openRow === rowRef.current) openRow = null;
      }}
      onSwipeableOpen={() => setIsOpen(true)}
      onSwipeableWillOpen={() => {
        if (openRow !== rowRef.current) openRow?.close();
        openRow = rowRef.current;
        revealRow();
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

/** The panel sits behind the card, so it is clear until the card moves: a lifting card then shows nothing behind it. */
function ActionsPanel({
  actions,
  isGrid,
  isOpen,
  methods,
  progress,
  width,
}: {
  actions: SwipeAction[];
  isGrid: boolean;
  isOpen: boolean;
  methods: SwipeableMethods;
  progress: SharedValue<number>;
  width: number;
}) {
  const visibility = useAnimatedStyle(() => ({ opacity: progress.value > 0 ? 1 : 0 }));

  return (
    <Animated.View
      accessibilityElementsHidden={!isOpen}
      className={isGrid ? "items-center justify-center gap-[18px] pl-1" : "flex-row pl-2"}
      importantForAccessibility={isOpen ? "auto" : "no-hide-descendants"}
      style={[{ width }, visibility]}
    >
      {actions.map((action) => (
        <ActionButton
          key={action.key}
          action={action}
          isGrid={isGrid}
          onPress={() => {
            methods.close();
            action.onPress();
          }}
        />
      ))}
    </Animated.View>
  );
}

function ActionButton({
  action,
  isGrid,
  onPress,
}: {
  action: SwipeAction;
  isGrid: boolean;
  onPress: () => void;
}) {
  const [onColour] = useThemeColor(["danger-foreground"] as const);
  const shopForeground = useCSSVariable("--color-shop-foreground");
  const icon =
    action.key === "groceries" && typeof shopForeground === "string" ? shopForeground : onColour;

  return (
    <Pressable
      accessibilityLabel={action.label}
      accessibilityRole="button"
      className={
        isGrid ? "w-[72px] items-center gap-1.5" : "flex-1 items-center justify-center gap-[7px]"
      }
      testID={action.testID}
      onPress={onPress}
    >
      <View
        className={`items-center justify-center rounded-full ${isGrid ? "size-11" : "size-12"} ${GROUND[action.key]}`}
        style={CIRCLE_SHADOW}
      >
        <Ionicons color={icon} name={ICONS[action.key]} size={isGrid ? 19 : 20} />
      </View>
      <Text className="text-muted text-xs font-medium">{action.label}</Text>
    </Pressable>
  );
}
