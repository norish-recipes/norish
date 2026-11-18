import type { ComponentProps, ComponentRef, ReactNode } from "react";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import React, { useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { GestureDetector, useManualGesture } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { PressableScale } from "@/components/pressable-scale";
import { useTokenColor } from "@/hooks/use-token-color";
import { lightImpact, mediumImpact } from "@/lib/haptics";
import { closeOpenRow, useOpenRow } from "@/lib/open-row";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

import type { RecipeSwipeAction } from "../utils/card-actions";
import { actionOffset, fullSwipeAt, swipeZone } from "../utils/swipe-reveal";

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

// List circles are 48 pt in a 208 pt panel, the card 8 pt short of it; grid circles 44 pt in an
// 80 pt one, 4 pt short.
const LAYOUTS = {
  list: {
    width: (count: number) => 8 + (208 / 3) * count,
    panel: "flex-row pl-2",
    slot: "flex-1",
    button: "items-center justify-center gap-[7px]",
    circle: "size-12",
    icon: 20,
  },
  grid: {
    width: () => 84,
    panel: "items-center justify-center gap-[18px] pl-1",
    slot: "w-[72px]",
    button: "items-center gap-1.5",
    circle: "size-11",
    icon: 19,
  },
};

type Layout = Omit<(typeof LAYOUTS)[RecipeViewMode], "width"> & { width: number; count: number };

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
  children,
}: {
  variant: RecipeViewMode;
  actions: SwipeAction[];
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rowRef = useRef<SwipeableMethods>(null);
  const boxRef = useRef<ComponentRef<typeof View>>(null);
  const openRow = useOpenRow(rowRef);
  // Whether a finger is on the card: the settle after a release neither ticks nor clears a full swipe.
  const dragging = useSharedValue(false);
  // Whether the finger is past the full swipe: a release there runs the first action.
  const fullSwipe = useSharedValue(false);
  const screenWidth = useWindowDimensions().width;
  // Where the card's right edge is on screen, read as a drag starts: a delete can move it a column.
  const [rightEdge, setRightEdge] = useState(screenWidth);
  const startDrag = () =>
    boxRef.current?.measureInWindow((x, _y, boxWidth) => setRightEdge(x + boxWidth));
  // Never activates; it only follows the finger on the UI thread, where a release beats the settle.
  const finger = useManualGesture({
    onTouchesDown: () => {
      "worklet";
      dragging.set(true);
      fullSwipe.set(false);
    },
    onTouchesUp: () => {
      "worklet";
      dragging.set(false);
    },
    onTouchesCancel: () => {
      "worklet";
      dragging.set(false);
    },
  });
  const { width, ...look } = LAYOUTS[variant];
  const layout: Layout = { ...look, width: width(actions.length), count: actions.length };
  const fullAt = fullSwipeAt(layout.width, rightEdge);

  return (
    // A touch on this row closes any other open one, and stops there: the list closes on any other.
    <GestureDetector gesture={finger}>
      <View
        ref={boxRef}
        className={variant === "grid" ? "flex-1" : undefined}
        onTouchStart={(event) => {
          event.stopPropagation();
          closeOpenRow(openRow.row);
        }}
      >
        <ReanimatedSwipeable
          ref={rowRef}
          containerStyle={variant === "grid" ? { flex: 1, borderRadius: 24 } : undefined}
          renderRightActions={(progress, translation, methods) => (
            <>
              <SwipeWatch
                dragging={dragging}
                fullAt={fullAt}
                fullSwipe={fullSwipe}
                translation={translation}
              />
              <ActionsPanel
                actions={actions}
                isOpen={isOpen}
                layout={layout}
                methods={methods}
                progress={progress}
                translation={translation}
              />
            </>
          )}
          rightThreshold={OPEN_THRESHOLD}
          simultaneousWith={finger}
          onSwipeableClose={() => {
            setIsOpen(false);
            openRow.closed();
          }}
          onSwipeableCloseStartDrag={startDrag}
          onSwipeableOpen={() => setIsOpen(true)}
          onSwipeableOpenStartDrag={startDrag}
          onSwipeableWillOpen={() => {
            if (fullSwipe.get() && actions[0]) {
              rowRef.current?.close();
              actions[0].onPress();
            } else openRow.opened();
          }}
        >
          {children}
        </ReanimatedSwipeable>
      </View>
    </GestureDetector>
  );
}

/** While a finger drags: a tick where a release would open the row and a firmer one at the full
 * swipe, each way the finger crosses them; the settle after a release plays none. */
function SwipeWatch({
  dragging,
  fullAt,
  fullSwipe,
  translation,
}: {
  dragging: SharedValue<boolean>;
  fullAt: number;
  fullSwipe: SharedValue<boolean>;
  translation: SharedValue<number>;
}) {
  useAnimatedReaction(
    () => swipeZone(-translation.get(), OPEN_THRESHOLD, fullAt),
    (zone, was) => {
      if (was === null || zone === was || !dragging.get()) return;
      fullSwipe.set(zone === "full");
      scheduleOnRN(zone === "full" || was === "full" ? mediumImpact : lightImpact);
    }
  );

  return null;
}

/** The panel sits behind the card, so it is clear until the card moves: a lifting card then shows nothing behind it. */
function ActionsPanel({
  actions,
  isOpen,
  layout,
  methods,
  progress,
  translation,
}: {
  actions: SwipeAction[];
  isOpen: boolean;
  layout: Layout;
  methods: SwipeableMethods;
  progress: SharedValue<number>;
  translation: SharedValue<number>;
}) {
  const visibility = useAnimatedStyle(() => ({ opacity: progress.value > 0 ? 1 : 0 }));

  return (
    <Animated.View
      accessibilityElementsHidden={!isOpen}
      className={layout.panel}
      importantForAccessibility={isOpen ? "auto" : "no-hide-descendants"}
      style={[{ width: layout.width }, visibility]}
    >
      {actions.map((action, index) => (
        <ActionButton
          key={action.key}
          action={action}
          index={index}
          layout={layout}
          translation={translation}
          onPress={() => {
            methods.close();
            action.onPress();
          }}
        />
      ))}
    </Animated.View>
  );
}

/** One action, sliding out of the card's edge at its own rate (`actionOffset`) on the UI thread. */
function ActionButton({
  action,
  index,
  layout,
  translation,
  onPress,
}: {
  action: SwipeAction;
  index: number;
  layout: Layout;
  translation: SharedValue<number>;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { width, count } = layout;
  const slide = useAnimatedStyle(() => ({
    transform: [
      { translateX: actionOffset(-translation.get(), width, index, count, reduceMotion) },
    ],
  }));
  const [onColour] = useThemeColor(["danger-foreground"] as const);
  const shopForeground = useTokenColor("shop-foreground");
  const icon = action.key === "groceries" && shopForeground ? shopForeground : onColour;

  return (
    <Animated.View className={layout.slot} style={slide}>
      <PressableScale
        accessibilityLabel={action.label}
        accessibilityRole="button"
        className={layout.button}
        testID={action.testID}
        onPress={onPress}
      >
        <View
          className={`items-center justify-center rounded-full ${layout.circle} ${GROUND[action.key]}`}
          style={CIRCLE_SHADOW}
        >
          <Ionicons color={icon} name={ICONS[action.key]} size={layout.icon} />
        </View>
        <Text className="text-muted text-xs font-medium">{action.label}</Text>
      </PressableScale>
    </Animated.View>
  );
}
