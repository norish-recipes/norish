import type { ComponentRef, RefObject } from "react";
import type { LayoutRectangle } from "react-native";
import React, { useEffect, useRef } from "react";
import { ActionSheetIOS, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@/components/icon";
import { TimerRing } from "@/components/timer-ring";
import { mediumImpact } from "@/lib/haptics";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { TimerMatch } from "@norish/shared/lib/timer-parser";
import { useLoadedPageRecipe } from "@norish/shared-react/recipes";
import { recipeTimerId, useTimerStore } from "@norish/shared-react/recipes/timers";
import { formatTimerMs } from "@norish/shared/lib/helpers";

import { askTimerNotifications } from "../hooks/use-recipe-timers";
import { toggleTimer } from "../utils/toggle-timer";
import { useTint } from "./tint";

// Text sets an inline view's foot on the font's descent, which a 28 pt chip in the 28 pt line needed
// shifting 5 pt to centre: a 24 pt chip centres with its foot 2 pt higher, so 3.
const SIZES = {
  page: { height: 24, shift: 3, text: "text-[14px]", icon: 14, ring: 14, stroke: 2.1 },
  cook: { height: 34, shift: 6, text: "text-xl", icon: 18, ring: 18, stroke: 2.6 },
} as const;

type ChipProps = {
  match: TimerMatch;
  index: number;
  stepIndex: number;
  size: keyof typeof SIZES;
};

/** A step duration's timer: a tap starts, pauses, resumes or dismisses it; a long press offers
 * Reset and Remove. */
function useChipTimer({ match, index, stepIndex }: ChipProps) {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const id = recipeTimerId(recipe.id, stepIndex, index);
  const timer = useTimerStore((state) => state.timers.find((entry) => entry.id === id));
  const addTimer = useTimerStore((state) => state.addTimer);
  const resetTimer = useTimerStore((state) => state.resetTimer);
  const removeTimer = useTimerStore((state) => state.removeTimer);
  const left = timer ? formatTimerMs(timer.remainingMs) : "";

  const press = () => {
    if (timer?.status === "completed") {
      removeTimer(id);

      return;
    }
    if (!timer) {
      addTimer({
        id,
        recipeId: recipe.id,
        label: intl.formatMessage({ id: "recipes.cookMode.stepLabel" }, { number: stepIndex + 1 }),
        durationMs: match.durationSeconds * 1000,
        recipeName: recipe.name,
        stepIndex,
      });
    }
    toggleTimer(id, timer?.status === "running");
    if (!timer) void askTimerNotifications();
  };

  const longPress = () => {
    if (!timer) return;

    mediumImpact();
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          intl.formatMessage({ id: "common.actions.reset" }),
          intl.formatMessage({ id: "common.actions.remove" }),
          intl.formatMessage({ id: "common.actions.cancel" }),
        ],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (choice) => {
        if (choice === 0) resetTimer(id);
        else if (choice === 1) removeTimer(id);
      }
    );
  };

  // The duration first, then what a tap does: VoiceOver and Maestro find a chip by it.
  const label = !timer
    ? intl.formatMessage({ id: "recipes.cookMode.startTimer" }, { duration: match.originalText })
    : [
        match.originalText,
        timer.status === "completed"
          ? `${intl.formatMessage({ id: "common.timer.done" })}, ${intl.formatMessage({ id: "recipes.cookMode.dismissTimer" })}`
          : intl.formatMessage(
              {
                id:
                  timer.status === "running"
                    ? "recipes.cookMode.pauseTimer"
                    : "recipes.cookMode.resumeTimer",
              },
              { time: left }
            ),
      ].join(", ");

  return { timer, left, label, press, longPress };
}

/** The chip drawn in the step's Text; inline views miss the accessibility tree, so TimerChipButton takes taps. */
export function TimerChip({
  withinRef,
  onPlace,
  layouts,
  ...props
}: ChipProps & {
  withinRef: RefObject<ComponentRef<typeof View> | null>;
  onPlace: (frame: LayoutRectangle) => void;
  /** Counts the step text's layouts, so a reflow with no render of the chip still re-measures it. */
  layouts: number;
}) {
  const intl = useIntl();
  const tint = useTint();
  const { timer, left } = useChipTimer(props);
  const [foreground, muted, accentForeground] = useThemeColor([
    "foreground",
    "muted",
    "accent-foreground",
  ] as const);
  const { height, shift, text, icon, ring, stroke } = SIZES[props.size];
  const done = timer?.status === "completed";
  const face = !timer ? "idle" : done ? "done" : "live";
  const faceRef = useRef<ComponentRef<typeof View>>(null);
  // A text size change re-lays the text natively; reading it re-renders the chip to re-measure.
  const { fontScale } = useWindowDimensions();

  // A view inside Text gets no onLayout, and Text places it after the commit: measured a frame later.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      withinRef.current?.measureInWindow((left, top) =>
        faceRef.current?.measureInWindow((x, y, width, height) =>
          onPlace({ x: x - left, y: y - top, width, height })
        )
      )
    );

    return () => cancelAnimationFrame(frame);
  }, [withinRef, onPlace, layouts, fontScale, timer?.status, left]);

  return (
    // Text sizes an inline view only as it lays out, so a chip that changes face or text length
    // ("10:00" to "9:59", "Done") is a new view, which makes the text measure it again.
    <View
      key={`${face}-${(left || props.match.originalText).length}`}
      ref={faceRef}
      className={`flex-row items-center gap-1.5 rounded-full pr-2.5 pl-2 ${done ? "bg-accent" : "bg-default"}`}
      style={[
        { height, transform: [{ translateY: shift }] },
        !done && tint ? { backgroundColor: tint.soft } : null,
      ]}
    >
      {!timer ? (
        <Ionicons color={foreground} name="time" size={icon} />
      ) : done ? (
        <Ionicons color={accentForeground} name="checkmark" size={icon} />
      ) : timer.status === "running" ? (
        <TimerRing
          color={foreground}
          left={timer.remainingMs / timer.originalDurationMs}
          size={ring}
          stroke={stroke}
        />
      ) : (
        <Ionicons color={muted} name="play" size={icon - 2} />
      )}
      <Text
        className={`${text} font-medium ${done ? "text-accent-foreground" : timer?.status === "paused" ? "text-muted" : "text-foreground"}`}
        style={timer && !done ? { fontVariant: ["tabular-nums"] } : undefined}
      >
        {!timer
          ? props.match.originalText
          : done
            ? intl.formatMessage({ id: "common.timer.done" })
            : left}
      </Text>
    </View>
  );
}

/** The chip's button, laid over where the Text drew it: the step's text stays one flow. */
export function TimerChipButton({ frame, ...props }: ChipProps & { frame: LayoutRectangle }) {
  const { label, press, longPress } = useChipTimer(props);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      // The page chip is 24 pt tall: the slop brings its tap target to 44 pt.
      hitSlop={{ top: 10, bottom: 10 }}
      style={{
        position: "absolute",
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
      }}
      testID={`timer-chip-${props.stepIndex}-${props.index}`}
      onLongPress={longPress}
      onPress={press}
    />
  );
}
