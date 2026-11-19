import type { ComponentProps, ComponentRef, ReactNode, Ref } from "react";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { GestureDetector, useManualGesture } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
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
import type { Reveal, SwipeZone } from "../utils/swipe-reveal";
import {
  actionOffset,
  cardTravel,
  collapseHeight,
  dropAway,
  FULL_SWIPE_OVERSHOOT,
  FULL_SWIPE_POP,
  fullSwipeAction,
  fullSwipeAt,
  swipeZone,
} from "../utils/swipe-reveal";

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

/** Plays the card's delete, then calls `done`, which removes it from the list. */
export type SwipeActionsHandle = {
  leave: (done: () => void) => void;
  /** Springs a card held for a delete's confirm back closed. */
  restore: () => void;
};

// A delete: the card is held at the full swipe for the confirm, slides off with the Delete circle
// stopped on that edge, which shrinks and fades as the row closes.
const LEAVE_EASE = Easing.out(Easing.cubic);
const HOLD_MS = 120;
const RESTORE_MS = 250;
const SLIDE_MS = 260;
// The board starts the circle's exit and the row's close this long after the slide starts.
const AFTER_SLIDE_MS = 350;
const CIRCLE_EXIT_MS = 200;
const COLLAPSE_MS = 350;
// ponytail: the removal is async, so the card stays hidden this long; a failed delete brings it back after it.
const HIDDEN_MS = 1000;

// How far a card is dragged, in pt, for a release to open it: ReanimatedSwipeable opens when the
// drag (plus a toss from its velocity) passes `-rightThreshold`, so the tick uses the same value.
const OPEN_THRESHOLD = 40;

// List circles are 48 pt in a 208 pt panel of three, the card 8 pt short of it; grid circles 44 pt in
// an 80 pt one, 4 pt short.
const LIST_STEP = 208 / 3;
const LAYOUTS = {
  list: {
    width: (count: number) => 8 + LIST_STEP * count,
    panel: "flex-row pl-2",
    step: LIST_STEP,
    slot: "flex-1",
    button: "items-center justify-center gap-[7px]",
    circle: "size-12",
    icon: 20,
  },
  grid: {
    width: () => 84,
    step: 0,
    panel: "items-center justify-center gap-[18px] pl-1",
    slot: "w-[72px]",
    button: "items-center gap-1.5",
    circle: "size-11",
    icon: 19,
  },
};

type Layout = Omit<(typeof LAYOUTS)[RecipeViewMode], "width"> & Reveal;

/** The delete's motion on the UI thread: how far the card is `extra` past its swipe, how much it is
 * `held` (0 to 1) at the full swipe, and how far its circle is `gone`. */
type DeleteMotion = {
  extra: SharedValue<number>;
  held: SharedValue<number>;
  gone: SharedValue<number>;
};

// A CSS `0 2px 8px` shadow at 14% black; iOS's radius is half the CSS blur.
const CIRCLE_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.14,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
};

/** The card's swipe-left actions: coloured circles on the page with a neutral label under each.
 * `ref` plays the card's delete; `itemKey` says which item that hid, as a recycled cell draws another. */
export function SwipeActions({
  ref,
  itemKey,
  variant,
  actions,
  children,
}: {
  ref?: Ref<SwipeActionsHandle>;
  itemKey: string;
  variant: RecipeViewMode;
  actions: SwipeAction[];
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [leftKey, setLeftKey] = useState<string | null>(null);
  const leaving = leftKey === itemKey;
  const screenWidth = useWindowDimensions().width;
  // The card's travel when it has left the screen, the Delete circle after it.
  const slideBy = screenWidth + FULL_SWIPE_OVERSHOOT;
  const slide = useSharedValue(0);
  const held = useSharedValue(0);
  const gone = useSharedValue(0);
  const collapse = useSharedValue(0);
  const boxHeight = useSharedValue(0);
  const rowRef = useRef<SwipeableMethods>(null);
  const { width, ...look } = LAYOUTS[variant];
  const openWidth = width(actions.length);
  // Where the card's right edge is on screen, read as a drag starts: a delete can move it a column.
  const [rightEdge, setRightEdge] = useState(screenWidth);
  const fullAt = fullSwipeAt(openWidth, rightEdge);
  const layout: Layout = { ...look, width: openWidth, count: actions.length, fullAt };
  const collapses = leaving && variant === "list";
  // The card sits `openWidth` out while held, so only the rest of its travel is its own.
  const extra = useDerivedValue(() =>
    leaving ? cardTravel(held.get(), slide.get(), fullAt, slideBy) - openWidth * held.get() : 0
  );
  const motion: DeleteMotion = { extra, held, gone };
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leaving ? -extra.get() : 0 }],
  }));
  const rowStyle = useAnimatedStyle(() => ({
    height: collapseHeight(collapses, boxHeight.get(), collapse.get()),
  }));

  // Holds the card where the full swipe left it, for the confirm.
  const hold = () => {
    setLeftKey(itemKey);
    held.set(withTiming(1, { duration: HOLD_MS, easing: LEAVE_EASE }));
  };

  // Back to a card at rest: the motion a delete leaves behind must not reach the cell's next item.
  const resetMotion = () => {
    slide.set(0);
    held.set(0);
    gone.set(0);
    collapse.set(0);
  };
  const lastKey = useRef(itemKey);

  // A recycled cell draws another item: it starts closed, whatever the last one was doing.
  useEffect(() => {
    if (lastKey.current === itemKey) return;
    lastKey.current = itemKey;
    rowRef.current?.reset();
    resetMotion();
    setIsOpen(false);
  }, [itemKey]);

  useImperativeHandle(ref, () => ({
    leave: (done) => {
      if (reduceMotion) return done();
      slide.set(0);
      gone.set(0);
      collapse.set(0);
      setLeftKey(itemKey);
      slide.set(withTiming(1, { duration: SLIDE_MS, easing: LEAVE_EASE }));
      gone.set(withDelay(AFTER_SLIDE_MS, withTiming(1, { duration: CIRCLE_EXIT_MS })));
      if (variant === "list")
        collapse.set(
          withDelay(AFTER_SLIDE_MS, withTiming(1, { duration: COLLAPSE_MS, easing: LEAVE_EASE }))
        );
      // On a timer, so a cancelled animation or a cell gone mid-way still deletes what was confirmed.
      setTimeout(
        () => {
          done();
          // Closed for the cell's next item, with the card still off screen.
          rowRef.current?.reset();
          held.set(0);
          setTimeout(() => {
            setLeftKey(null);
            resetMotion();
          }, HIDDEN_MS);
        },
        AFTER_SLIDE_MS + (variant === "list" ? COLLAPSE_MS : 0)
      );
    },
    restore: () => {
      if (held.get() === 0) return;
      rowRef.current?.close();
      held.set(withTiming(0, { duration: RESTORE_MS, easing: LEAVE_EASE }));
      setTimeout(() => setLeftKey(null), RESTORE_MS);
    },
  }));
  const boxRef = useRef<ComponentRef<typeof View>>(null);
  const openRow = useOpenRow(rowRef);
  // Whether a finger is on the card: the settle after a release neither ticks nor clears a full swipe.
  const dragging = useSharedValue(false);
  // Whether the finger is past the full swipe: a release there runs the outermost action.
  const fullSwipe = useSharedValue(false);
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

  return (
    // A touch on this row closes any other open one, and stops there: the list closes on any other.
    <GestureDetector gesture={finger}>
      <Animated.View
        ref={boxRef}
        className={`${variant === "grid" ? "flex-1" : ""} ${leaving ? "overflow-hidden" : ""}`}
        style={rowStyle}
        testID={leaving ? "card-leaving" : undefined}
        onLayout={(event) => {
          if (!collapses) boxHeight.set(event.nativeEvent.layout.height);
        }}
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
                motion={motion}
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
            const fullAction = fullSwipeAction(actions);

            if (fullSwipe.get() && fullAction) {
              // A delete holds the card for its confirm; Reduce Motion deletes from rest.
              if (fullAction.key === "delete" && !reduceMotion) hold();
              else rowRef.current?.close();
              fullAction.onPress();
            } else openRow.opened();
          }}
        >
          <Animated.View className={variant === "grid" ? "flex-1" : undefined} style={contentStyle}>
            {children}
          </Animated.View>
        </ReanimatedSwipeable>
      </Animated.View>
    </GestureDetector>
  );
}

/** While a finger drags: a tick where a release would open the row and a firmer one at the full
 * swipe, each way the finger really crosses them; the settle after a release plays none. */
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
  // The zone the card was in last frame: `swipeZone` needs it to hold a full swipe near the line.
  const zone = useSharedValue<SwipeZone>("closed");

  useAnimatedReaction(
    () => -translation.get(),
    (travel) => {
      const was = zone.get();
      const next = swipeZone(travel, OPEN_THRESHOLD, fullAt, was);

      if (next === was) return;
      zone.set(next);
      if (!dragging.get()) return;
      fullSwipe.set(next === "full");
      scheduleOnRN(next === "full" || was === "full" ? mediumImpact : lightImpact);
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
  motion,
  progress,
  translation,
}: {
  actions: SwipeAction[];
  isOpen: boolean;
  layout: Layout;
  methods: SwipeableMethods;
  motion: DeleteMotion;
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
          motion={motion}
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
  motion,
  translation,
  onPress,
}: {
  action: SwipeAction;
  index: number;
  layout: Layout;
  motion: DeleteMotion;
  translation: SharedValue<number>;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const outermost = index === layout.count - 1;
  const slide = useAnimatedStyle(() => {
    const finger = -translation.get();
    // A deleted card carries on past the swipe; the circle stays on the edge it was held at.
    const travel = Math.max(finger, Math.min(finger + motion.extra.get(), layout.fullAt));
    // Past the open width the outermost circle pops a little, the others shrink and fade.
    const drop = reduceMotion ? 0 : dropAway(travel, layout);
    const pop = 1 + (FULL_SWIPE_POP - 1) * drop * (1 - motion.held.get());
    const exit = outermost ? motion.gone.get() : 0;

    return {
      opacity: (outermost ? 1 : 1 - drop) * (1 - exit),
      transform: [
        { translateX: actionOffset(travel, layout, index, reduceMotion) },
        { scale: (outermost ? pop : 1 - 0.4 * drop) * (1 - 0.7 * exit) },
      ],
    };
  });
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
