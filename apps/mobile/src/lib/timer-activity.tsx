import type { LiveActivityEnvironment } from "expo-widgets";
import { Platform } from "react-native";
import { Divider, HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  frame,
  labelsHidden,
  lineLimit,
  monospacedDigit,
  padding,
  progressViewStyle,
  tint,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";

import { createClientLogger } from "@norish/shared/lib/logger";

import type {
  TimerActivityPlan,
  TimerActivityProps,
  TimerActivityRow,
} from "./timer-activity-state";

const log = createClientLogger("recipe-timers");

// Runs in the widget extension's own runtime: everything it uses is declared inside it.
const timerActivityLayout = (props: TimerActivityProps, environment: LiveActivityEnvironment) => {
  "widget";
  const dark = environment.colorScheme === "dark";
  // The app theme's accent, muted and surface tokens in sRGB, and the Dynamic Island's green.
  const accent = dark ? "#76BE86" : "#336640";
  const muted = dark ? "#A7A29C" : "#6E6A63";
  const surface = dark ? "#1C1A16" : "#FBF8F0";
  const go = "#7FDB8E";
  // Stale means every running timer passed its end while the app slept.
  const done = props.done || environment.isStale === true;

  const ring = (row: TimerActivityRow, size: number, color: string) => {
    if (done) return <Image color={color} size={size} systemName="checkmark.circle.fill" />;
    const style = [
      progressViewStyle("circular"),
      labelsHidden(),
      // The timer form draws its own time inside the ring; the row already shows it.
      foregroundStyle("clear"),
      tint(color),
      frame({ width: size, height: size }),
    ];

    return row.endsAt === null ? (
      <ProgressView modifiers={style} value={(row.remainingMs ?? 0) / row.durationMs} />
    ) : (
      <ProgressView
        countsDown
        modifiers={style}
        timerInterval={{
          lower: new Date(row.endsAt - row.durationMs),
          upper: new Date(row.endsAt),
        }}
      />
    );
  };

  const left = (row: TimerActivityRow, size: number, color: string) => {
    const label = done ? props.doneLabel : row.label;

    // "Paused" and "Done" are words, so they stay body-sized beside a countdown.
    if (label !== null || row.endsAt === null)
      return (
        <Text
          modifiers={[
            font({ size: 15, weight: "semibold" }),
            foregroundStyle(done ? color : muted),
          ]}
        >
          {label ?? ""}
        </Text>
      );

    return (
      <Text
        countsDown
        modifiers={[
          font({ size, weight: "semibold" }),
          monospacedDigit(),
          foregroundStyle(color),
          frame({ width: size * 4, alignment: "trailing" }),
        ]}
        timerInterval={{
          lower: new Date(row.endsAt - row.durationMs),
          upper: new Date(row.endsAt),
        }}
      />
    );
  };

  const rows = (stepColor: string, color: string) => (
    <VStack spacing={0}>
      {props.rows.map((row, index) => (
        <VStack key={row.id} spacing={0}>
          {index > 0 ? <Divider /> : null}
          {/* iOS caps a Lock Screen activity at 160 pt: three 42 pt rows and the "+N" line fit. */}
          <HStack modifiers={[frame({ height: 42 })]} spacing={12}>
            {ring(row, 26, row.endsAt === null && !done ? muted : color)}
            <VStack alignment="leading" spacing={1}>
              <Text modifiers={[font({ size: 15, weight: "semibold" }), lineLimit(1)]}>
                {row.recipe}
              </Text>
              {row.step ? (
                <Text modifiers={[font({ size: 13 }), foregroundStyle(stepColor), lineLimit(1)]}>
                  {row.step}
                </Text>
              ) : null}
            </VStack>
            <Spacer />
            {left(row, 22, color)}
          </HStack>
        </VStack>
      ))}
      {props.more ? (
        <HStack modifiers={[padding({ top: 4 })]}>
          <Text modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(stepColor)]}>
            {props.more}
          </Text>
          <Spacer />
        </HStack>
      ) : null}
    </VStack>
  );

  const first = props.rows[0];

  return {
    banner: (
      <VStack
        modifiers={[
          padding({ horizontal: 18, vertical: 10 }),
          activityBackgroundTint(surface),
          widgetURL(props.url),
        ]}
      >
        {rows(muted, accent)}
      </VStack>
    ),
    compactLeading: first ? (
      <HStack modifiers={[widgetURL(props.url)]}>{ring(first, 23, go)}</HStack>
    ) : undefined,
    compactTrailing: first ? left(first, 16, go) : undefined,
    minimal: first ? (
      <HStack modifiers={[widgetURL(props.url)]}>{ring(first, 23, go)}</HStack>
    ) : undefined,
    expandedBottom: (
      <VStack modifiers={[padding({ horizontal: 12 }), widgetURL(props.url)]}>
        {rows("#FFFFFF9E", go)}
      </VStack>
    ),
  };
};

// The factory exists on iOS only; Android has no Live Activities.
const factory =
  Platform.OS === "ios" ? createLiveActivity("RecipeTimers", timerActivityLayout) : null;

let pushed: string | null = null;

/** Starts, updates or ends the one Live Activity so it shows `plan`; an unchanged plan is not pushed. */
export async function syncTimerActivity(plan: TimerActivityPlan): Promise<void> {
  if (!factory) return;

  try {
    // A crash or a second start can leave more than one; the first is kept.
    const [activity, ...extra] = factory.getInstances();

    await Promise.all(extra.map((stale) => stale.end("immediate")));

    if (plan.kind === "show") {
      const content = JSON.stringify(plan);

      if (activity && content === pushed) return;
      const staleDate = plan.staleAt === null ? undefined : new Date(plan.staleAt);

      if (activity) await activity.update(plan.props, staleDate);
      else factory.start(plan.props, undefined, staleDate);
      pushed = content;

      return;
    }

    pushed = null;
    if (!activity) return;
    // Done stays on the Lock Screen until iOS clears it; a removal or a session end goes at once.
    if (plan.kind === "done") await activity.end("default", plan.props);
    else await activity.end("immediate");
  } catch (error) {
    log.warn({ error }, "Could not update the timers' Live Activity");
  }
}
