import type { Reveal, SwipeZone } from "@/lib/swipe-reveal";
import type { ComponentProps, ComponentRef, ReactNode, Ref } from "react";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SharedValue } from "react-native-reanimated";
import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
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
import { lightImpact, mediumImpact } from "@/lib/haptics";
import { closeOpenRow, useOpenRow } from "@/lib/open-row";
import {
  actionOffset,
  capsuleStretch,
  cardTravel,
  collapseHeight,
  dropAway,
  FULL_SWIPE_OVERSHOOT,
  fullSwipeAction,
  fullSwipeAt,
  swipeZone,
} from "@/lib/swipe-reveal";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** A row's size: `list` and `grid` are the recipe cards', `row` the list's scaled to fit a 50 pt row. */
export type SwipeVariant = "list" | "grid" | "row";

export type SwipeAction = {
  key: string;
  label: string;
  /** The text under the circle, where it is shorter than the spoken `label`. */
  caption?: string;
  icon: IconName;
  /** The circle's background class, such as `bg-danger`. */
  ground: string;
  /** The icon's colour; white (`danger-foreground`) when unset. */
  ink?: string;
  /** The row stays open under the action's confirm, and a full swipe holds it there (a card's Delete). */
  holdsOpen?: boolean;
  /** It asks before it acts (a confirm or a sheet), so a full swipe may run it. */
  asks: boolean;
  onPress: () => void;
  testID: string;
};

/** Plays the card's delete, then calls `done`, which removes it from the list. */
export type SwipeActionsHandle = {
  leave: (done: () => void) => void;
  /** Springs a card held for a delete's confirm back closed. */
  restore: () => void;
};

// A delete: the card is held open (at the full swipe after one) for the confirm, then the Delete
// circle stretches into a red capsule behind the card's edge as it leaves, and fades as the row closes.
const LEAVE_EASE = Easing.out(Easing.cubic);
// The push off screen eases in and out, so the red visibly sweeps right to left as it fills.
const SLIDE_EASE = Easing.inOut(Easing.cubic);
const HOLD_MS = 120;
export const RESTORE_MS = 250;
const SLIDE_MS = 520;
// The capsule's fade and the row's close start once the fill has settled.
const AFTER_SLIDE_MS = SLIDE_MS + 80;
const CIRCLE_EXIT_MS = 200;
const COLLAPSE_MS = 350;
// ponytail: the removal is async, so the card stays hidden this long; a failed delete brings it back after it.
export const HIDDEN_MS = 1000;

/** When a leaving card hands over its removal: once the fill settles, and in a list the row closes. */
export const leaveMs = (variant: SwipeVariant) =>
  AFTER_SLIDE_MS + (variant === "list" ? COLLAPSE_MS : 0);

// How far a card is dragged, in pt, for a release to open it: ReanimatedSwipeable opens when the
// drag (plus a toss from its velocity) passes `-rightThreshold`, so the tick uses the same value.
const OPEN_THRESHOLD = 40;

// Circles: list 48 pt in a 208 pt panel of three, grid 44 pt in an 80 pt one, row 30 pt over a 12 pt
// line to fit 50 pt. `circleLeft` is a resting circle's left edge from the row's right.
const LIST_STEP = 208 / 3;
const ROW_STEP = 60;
// The room a stretched capsule leaves at the row's left edge.
const CAPSULE_INSET = 16;
const LAYOUTS = {
  list: {
    width: (count: number) => 8 + LIST_STEP * count,
    panel: "flex-row pl-2",
    step: LIST_STEP,
    slot: "flex-1 justify-center",
    button: "items-center justify-center gap-[7px]",
    circleSize: 48,
    circleLeft: (LIST_STEP + 48) / 2,
    icon: 20,
    text: "text-xs",
    captionScale: undefined,
    shrinkToOneLine: false,
  },
  row: {
    width: (count: number) => 8 + ROW_STEP * count,
    panel: "flex-row pl-2",
    step: ROW_STEP,
    slot: "flex-1 justify-center",
    button: "items-center justify-center gap-[3px]",
    circleSize: 30,
    circleLeft: (ROW_STEP + 30) / 2,
    icon: 14,
    text: "text-center text-[10px] leading-3",
    // At most 1.2x under Dynamic Type: 30 + 3 + 14.4 pt still fits a 50 pt row with its shadow.
    captionScale: 1.2,
    shrinkToOneLine: true,
  },
  grid: {
    width: () => 84,
    step: 0,
    panel: "items-center justify-center gap-[18px] pl-1",
    slot: "w-[72px]",
    button: "items-center gap-1.5",
    circleSize: 44,
    circleLeft: 62,
    icon: 19,
    text: "text-xs",
    captionScale: undefined,
    shrinkToOneLine: false,
  },
};

/** `commits`: a full swipe runs the outermost action, so its circle stretches and the others fade. */
type Layout = Omit<(typeof LAYOUTS)[SwipeVariant], "width"> & Reveal & { commits: boolean };

/** The delete's motion on the UI thread: how far the card is `extra` past its swipe, how far its
 * capsule is `gone`, and the most it can stretch (`reach`). */
type DeleteMotion = {
  extra: SharedValue<number>;
  gone: SharedValue<number>;
  reach: SharedValue<number>;
};

// A CSS `0 2px 8px` shadow at 14% black; iOS's radius is half the CSS blur.
const CIRCLE_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.14,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
};

/** A row's swipe-left actions: coloured circles with a neutral label under each; none while not
 * `enabled`, which closes an open row. `ref` plays a card's delete; `itemKey` says which item that hid, as a recycled cell draws another. */
export function SwipeActions({
  ref,
  itemKey,
  variant,
  actions,
  enabled = true,
  children,
}: {
  ref?: Ref<SwipeActionsHandle>;
  itemKey: string;
  variant: SwipeVariant;
  actions: SwipeAction[];
  enabled?: boolean;
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
  const boxWidth = useSharedValue(0);
  const rowRef = useRef<SwipeableMethods>(null);
  const openRow = useOpenRow(rowRef);
  const { width, ...look } = LAYOUTS[variant];
  const openWidth = width(actions.length);
  // Where the card's right edge is on screen, read as a drag starts: a delete can move it a column.
  const [rightEdge, setRightEdge] = useState(screenWidth);
  const fullAt = fullSwipeAt(openWidth, rightEdge);
  const fullAction = fullSwipeAction(actions);
  const layout: Layout = {
    ...look,
    width: openWidth,
    count: actions.length,
    fullAt,
    commits: fullAction !== undefined,
  };
  const collapses = leaving && variant === "list";
  // The card sits `openWidth` out while held, so only the rest of its travel is its own.
  const extra = useDerivedValue(() =>
    leaving ? cardTravel(held.get(), slide.get(), fullAt, slideBy) - openWidth * held.get() : 0
  );
  const reach = useDerivedValue(() =>
    Math.max(0, boxWidth.get() - CAPSULE_INSET - look.circleLeft)
  );
  const motion: DeleteMotion = { extra, gone, reach };
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

  // A row left open as the swipe is turned off (Offline) closes, so its actions can't be pressed.
  useEffect(() => {
    if (!enabled && isOpen) rowRef.current?.close();
  }, [enabled, isOpen]);

  useImperativeHandle(ref, () => ({
    leave: (done) => {
      if (reduceMotion) return done();
      slide.set(0);
      gone.set(0);
      collapse.set(0);
      setLeftKey(itemKey);
      slide.set(withTiming(1, { duration: SLIDE_MS, easing: SLIDE_EASE }));
      gone.set(withDelay(AFTER_SLIDE_MS, withTiming(1, { duration: CIRCLE_EXIT_MS })));
      if (variant === "list")
        collapse.set(
          withDelay(AFTER_SLIDE_MS, withTiming(1, { duration: COLLAPSE_MS, easing: LEAVE_EASE }))
        );
      // On a timer, so a cancelled animation or a cell gone mid-way still deletes what was confirmed.
      setTimeout(() => {
        done();
        // Closed for the cell's next item, with the card still off screen; a reset reports no close.
        rowRef.current?.reset();
        setIsOpen(false);
        openRow.closed();
        held.set(0);
        setTimeout(() => {
          setLeftKey(null);
          resetMotion();
        }, HIDDEN_MS);
      }, leaveMs(variant));
    },
    restore: () => {
      if (held.get() === 0) return;
      rowRef.current?.close();
      held.set(withTiming(0, { duration: RESTORE_MS, easing: LEAVE_EASE }));
      setTimeout(() => setLeftKey(null), RESTORE_MS);
    },
  }));
  const boxRef = useRef<ComponentRef<typeof View>>(null);
  // Whether a finger is on the card: the settle after a release neither ticks nor clears a full swipe.
  const dragging = useSharedValue(false);
  // Whether the finger is past the full swipe: a release there runs the outermost action.
  const fullSwipe = useSharedValue(false);
  const startDrag = () =>
    boxRef.current?.measureInWindow((x, _y, measured) => setRightEdge(x + measured));
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
          boxWidth.set(event.nativeEvent.layout.width);
        }}
        onTouchStart={(event) => {
          event.stopPropagation();
          closeOpenRow(openRow.row);
        }}
      >
        <ReanimatedSwipeable
          ref={rowRef}
          containerStyle={variant === "grid" ? { flex: 1, borderRadius: 24 } : undefined}
          enabled={enabled}
          renderRightActions={(progress, translation, methods) => (
            <>
              <SwipeWatch
                dragging={dragging}
                fullAt={fullAction ? fullAt : Infinity}
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
            if (fullSwipe.get() && fullAction) {
              // A card's delete holds it for its confirm; Reduce Motion deletes from rest.
              if (fullAction.holdsOpen && !reduceMotion) hold();
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
            // A card's delete keeps the row open under its confirm, as Mail does; Cancel leaves it open.
            if (!action.holdsOpen) methods.close();
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
  const stretches = outermost && layout.commits && !reduceMotion;
  // How far the card is over the panel: a deleted card carries on past the swipe.
  const travel = useDerivedValue(() => -translation.get() + motion.extra.get());
  const stretch = useDerivedValue(() =>
    stretches ? capsuleStretch(travel.get(), layout, motion.reach.get()) : 0
  );
  const slide = useAnimatedStyle(() => {
    // Past the open width the other actions shrink and fade under the outermost's capsule.
    const drop = reduceMotion || outermost || !layout.commits ? 0 : dropAway(travel.get(), layout);

    return {
      opacity: (1 - drop) * (outermost ? 1 - motion.gone.get() : 1),
      transform: [
        { translateX: actionOffset(travel.get(), layout, index, reduceMotion) },
        { scale: 1 - 0.4 * drop },
      ],
    };
  });
  // The circle grows left from its right edge, as Mail's red capsule fills behind the card.
  const capsule = useAnimatedStyle(() => ({
    width: layout.circleSize + stretch.get(),
    transform: [{ translateX: -stretch.get() / 2 }],
  }));
  const label = useAnimatedStyle(() => ({ opacity: 1 - Math.min(stretch.get() / 16, 1) }));
  const [onColour] = useThemeColor(["danger-foreground"] as const);

  return (
    <Animated.View className={layout.slot} style={slide}>
      <PressableScale
        accessibilityLabel={action.label}
        accessibilityRole="button"
        className={layout.button}
        testID={action.testID}
        onPress={onPress}
      >
        <Animated.View
          className={`flex-row items-center rounded-full ${action.ground}`}
          style={[
            CIRCLE_SHADOW,
            {
              width: layout.circleSize,
              height: layout.circleSize,
              paddingLeft: (layout.circleSize - layout.icon) / 2,
            },
            outermost ? capsule : null,
          ]}
        >
          <Ionicons color={action.ink ?? onColour} name={action.icon} size={layout.icon} />
        </Animated.View>
        <Animated.Text
          adjustsFontSizeToFit={layout.shrinkToOneLine}
          className={`text-muted font-medium ${layout.text}`}
          maxFontSizeMultiplier={layout.captionScale}
          minimumFontScale={layout.shrinkToOneLine ? 0.7 : undefined}
          numberOfLines={layout.shrinkToOneLine ? 1 : undefined}
          style={label}
        >
          {action.caption ?? action.label}
        </Animated.Text>
      </PressableScale>
    </Animated.View>
  );
}
