import type { ComponentProps, ReactNode } from "react";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { PressableScale } from "@/components/pressable-scale";
import { useTokenColor } from "@/hooks/use-token-color";
import { lightImpact } from "@/lib/haptics";
import { useOpenRow } from "@/lib/open-row";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

import type { RecipeSwipeAction } from "../utils/card-actions";

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

// How far a card is dragged, in pt, for a release to open it: ReanimatedSwipeable opens when the
// drag (plus a toss from its velocity) passes `-rightThreshold`, so the tick uses the same value.
const OPEN_THRESHOLD = 40;

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

/** The card's swipe-left actions: coloured circles on the page with a neutral label under each. */
export function SwipeActions({
  variant,
  actions,
  stripGesture,
  children,
}: {
  variant: RecipeViewMode;
  actions: SwipeAction[];
  /** A sideways strip on the card: the swipe waits for it to decline a drag. */
  stripGesture?: ComponentProps<typeof ReanimatedSwipeable>["requireToFail"];
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rowRef = useRef<SwipeableMethods>(null);
  const openRow = useOpenRow(rowRef);
  // Whether a finger is dragging the card, so the threshold's haptic is not played by the settle.
  const dragging = useSharedValue(false);
  const isGrid = variant === "grid";
  const width = isGrid ? GRID_PANEL + GRID_GAP : LIST_GAP + LIST_BUTTON * actions.length;

  return (
    // A touch on this row closes any other open one, and stops there: the list closes on any other.
    <View
      className={isGrid ? "flex-1" : undefined}
      onTouchStart={(event) => {
        event.stopPropagation();
        openRow.touched();
      }}
    >
      <ReanimatedSwipeable
        ref={rowRef}
        containerStyle={isGrid ? { flex: 1, borderRadius: 24 } : undefined}
        overshootRight={false}
        renderRightActions={(progress, translation, methods) => (
          <ActionsPanel
            actions={actions}
            dragging={dragging}
            isGrid={isGrid}
            isOpen={isOpen}
            methods={methods}
            progress={progress}
            translation={translation}
            width={width}
          />
        )}
        requireToFail={stripGesture}
        rightThreshold={OPEN_THRESHOLD}
        onSwipeableClose={() => {
          setIsOpen(false);
          openRow.closed();
        }}
        onSwipeableCloseStartDrag={() => dragging.set(true)}
        onSwipeableOpen={() => setIsOpen(true)}
        onSwipeableOpenStartDrag={() => dragging.set(true)}
        onSwipeableWillClose={() => dragging.set(false)}
        onSwipeableWillOpen={() => {
          dragging.set(false);
          openRow.opened();
        }}
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}

/** The panel sits behind the card, so it is clear until the card moves: a lifting card then shows nothing behind it. */
function ActionsPanel({
  actions,
  dragging,
  isGrid,
  isOpen,
  methods,
  progress,
  translation,
  width,
}: {
  actions: SwipeAction[];
  dragging: SharedValue<boolean>;
  isGrid: boolean;
  isOpen: boolean;
  methods: SwipeableMethods;
  progress: SharedValue<number>;
  translation: SharedValue<number>;
  width: number;
}) {
  const visibility = useAnimatedStyle(() => ({ opacity: progress.value > 0 ? 1 : 0 }));

  // A tick where a release would open the row, each way the finger crosses it.
  useAnimatedReaction(
    () => translation.get() < -OPEN_THRESHOLD,
    (past, was) => {
      if (was !== null && past !== was && dragging.get()) scheduleOnRN(lightImpact);
    }
  );

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
  const shopForeground = useTokenColor("shop-foreground");
  const icon = action.key === "groceries" && shopForeground ? shopForeground : onColour;

  return (
    <PressableScale
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
    </PressableScale>
  );
}
