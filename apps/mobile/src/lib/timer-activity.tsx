import type { LiveActivityEnvironment } from "expo-widgets";
import type { ReactNode } from "react";
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
import { keepStarts } from "./timer-activity-state";

const log = createClientLogger("recipe-timers");

// Runs in the widget extension's own runtime: everything it uses is declared inside it.
const timerActivityLayout = (props: TimerActivityProps, environment: LiveActivityEnvironment) => {
  "widget";
  const dark = environment.colorScheme === "dark";
  // The app theme's accent, muted and surface tokens in sRGB, and the Dynamic Island's green.
  const accent = dark ? "#76BE86" : "#336640";
  const muted = dark ? "#A7A29C" : "#6E6A63";
  const surface = dark ? "#1C1A16" : "#FBF8F0";
  const islandGreen = "#7FDB8E";

  // Stale means every running timer passed its end while the app slept: those rows read Done.
  const listed = props.rows.map((row): TimerActivityRow =>
    row.state === "running" && environment.isStale === true
      ? { id: row.id, recipe: row.recipe, step: row.step, state: "done" }
      : row
  );
  const interval = (row: { startsAt: number; endsAt: number }) => ({
    lower: new Date(row.startsAt),
    upper: new Date(row.endsAt),
  });
  // Every island region carries the link: the activity's own URL is fixed when it starts.
  const linked = (child: ReactNode) => <HStack modifiers={[widgetURL(props.url)]}>{child}</HStack>;

  const ring = (row: TimerActivityRow, size: number, color: string) => {
    if (row.state === "done")
      return <Image color={color} size={size} systemName="checkmark.circle.fill" />;
    const style = [
      progressViewStyle("circular"),
      labelsHidden(),
      // The timer form draws its own time inside the ring; the row already shows it.
      foregroundStyle("clear"),
      tint(row.state === "paused" ? muted : color),
      frame({ width: size, height: size }),
    ];

    return row.state === "paused" ? (
      <ProgressView modifiers={style} value={row.remainingMs / row.durationMs} />
    ) : (
      <ProgressView countsDown modifiers={style} timerInterval={interval(row)} />
    );
  };

  // The time left, or "Paused" and "Done", which stay body-sized beside a countdown.
  const readout = (row: TimerActivityRow, size: number, color: string) => {
    if (row.state === "running")
      return (
        <Text
          countsDown
          modifiers={[
            font({ size, weight: "semibold" }),
            monospacedDigit(),
            foregroundStyle(color),
            frame({ width: size * 4, alignment: "trailing" }),
          ]}
          timerInterval={interval(row)}
        />
      );
    const paused = row.state === "paused";

    return (
      <Text
        modifiers={[
          font({ size: 15, weight: "semibold" }),
          foregroundStyle(paused ? muted : color),
        ]}
      >
        {paused ? props.pausedLabel : props.doneLabel}
      </Text>
    );
  };

  const rows = (stepColor: string, color: string) => (
    <VStack spacing={0}>
      {listed.map((row, index) => (
        <VStack key={row.id} spacing={0}>
          {index > 0 ? <Divider /> : null}
          {/* iOS caps a Lock Screen activity at 160 pt: three 42 pt rows and the "+N" line fit. */}
          <HStack modifiers={[frame({ height: 42 })]} spacing={12}>
            {ring(row, 26, color)}
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
            {readout(row, 22, color)}
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

  const first = listed[0];

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
    compactLeading: first ? linked(ring(first, 23, islandGreen)) : undefined,
    compactTrailing: first ? linked(readout(first, 16, islandGreen)) : undefined,
    minimal: first ? linked(ring(first, 23, islandGreen)) : undefined,
    expandedBottom: (
      <VStack modifiers={[padding({ horizontal: 12 }), widgetURL(props.url)]}>
        {rows("#FFFFFF9E", islandGreen)}
      </VStack>
    ),
  };
};

// The factory exists on iOS only; Android has no Live Activities.
const factory =
  Platform.OS === "ios" ? createLiveActivity("RecipeTimers", timerActivityLayout) : null;

let shown: { content: string; props: TimerActivityProps } | null = null;
// The timers running at the last sync; null before the first, so a launch starts nothing.
let running: ReadonlySet<string> | null = null;

/** Starts, updates or ends the one Live Activity so it shows `plan`; an unchanged plan is not pushed. */
export async function syncTimerActivity(plan: TimerActivityPlan): Promise<void> {
  if (!factory) return;
  const before = running;

  running = new Set(plan.kind === "show" ? plan.running : []);

  try {
    // A crash or a second start can leave more than one; the first is kept.
    const [activity, ...extra] = factory.getInstances();

    await Promise.all(extra.map((stale) => stale.end("immediate")));

    if (plan.kind === "show") {
      const props = keepStarts(plan.props, shown?.props ?? null);
      const content = JSON.stringify({ props, staleAt: plan.staleAt });

      if (activity && content === shown?.content) return;
      const staleDate = plan.staleAt === null ? undefined : new Date(plan.staleAt);

      if (activity) await activity.update(props, staleDate);
      // Only a timer starting brings back an activity the user swiped away (or starts the first).
      else if (before && plan.running.some((id) => !before.has(id)))
        factory.start(props, undefined, staleDate);
      else {
        shown = null;

        return;
      }
      shown = { content, props };

      return;
    }

    shown = null;
    if (!activity) return;
    // Done stays on the Lock Screen until iOS clears it; a removal or a session end goes at once.
    if (plan.kind === "done") await activity.end("default", plan.props);
    else await activity.end("immediate");
  } catch (error) {
    log.warn({ error }, "Could not update the timers' Live Activity");
  }
}
