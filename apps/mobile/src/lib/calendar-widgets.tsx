import type { WidgetEnvironment } from "expo-widgets";
import { Platform } from "react-native";
import {
  HStack,
  Image,
  Link,
  Rectangle,
  RoundedRectangle,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  aspectRatio,
  clipped,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  resizable,
  strokeBorder,
  widgetAccentedRenderingMode,
  widgetURL,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget } from "expo-widgets";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { createClientLogger } from "@norish/shared/lib/logger";

import type {
  LargeWidgetProps,
  SmallWidgetProps,
  WidgetMessage,
  WidgetStrings,
  WidgetTimelines,
} from "./calendar-widgets-state";
import { clearPhotos, renderWithPhotos } from "./calendar-widget-photos";
import { calendarWidgetTimelines, signedOutTimelines, todayUrl } from "./calendar-widgets-state";

const log = createClientLogger("calendar-widgets");

// Both layouts run in the widget extension's own runtime: everything they use is declared inside.
const mealLayout = (props: SmallWidgetProps, environment: WidgetEnvironment) => {
  "widget";
  const dark = environment.colorScheme === "dark";
  // The board's widget tokens in sRGB; an 8-digit hex is RGBA here.
  const ground = dark ? "#201E1A" : "#FFFFFF";
  const ink = dark ? "#FBFCFC" : "#181918";
  const muted = dark ? "#AEAAA3" : "#615D56";
  const accent = dark ? "#76C788" : "#336640";
  const label = (text: string, color: string) => (
    <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(color)]}>{text}</Text>
  );
  const title = (text: string, color: string, size = 16) => (
    <Text modifiers={[font({ size, weight: "semibold" }), foregroundStyle(color), lineLimit(2)]}>
      {text}
    </Text>
  );
  const date = (weekday: string, day: string, color: string, dayColor: string) => (
    <VStack alignment="leading" spacing={0}>
      {label(weekday, color)}
      <Text modifiers={[font({ size: 40, weight: "semibold" }), foregroundStyle(dayColor)]}>
        {day}
      </Text>
    </VStack>
  );
  const card = (url: string, background: string, children: React.ReactNode) => (
    <HStack modifiers={[containerBackground(background, "widget"), widgetURL(url)]}>
      <VStack
        alignment="leading"
        modifiers={[padding({ top: 15, leading: 16, trailing: 16, bottom: 14 })]}
        spacing={0}
      >
        {children}
      </VStack>
      <Spacer />
    </HStack>
  );

  if (props.kind === "message") {
    return card(props.url, ground, [<Spacer key="space" />, title(props.text, ink, 17)]);
  }
  if (props.kind === "empty") {
    return card(props.url, ground, [
      <VStack key="date">{date(props.weekday, props.day, accent, ink)}</VStack>,
      <Spacer key="space" />,
      <VStack key="text">{title(props.text, muted)}</VStack>,
    ]);
  }
  const text = [
    <VStack key="date">
      {date(
        props.weekday,
        props.day,
        props.photo ? "#FFFFFF" : accent,
        props.photo ? "#FFFFFF" : ink
      )}
    </VStack>,
    <Spacer key="space" />,
    <VStack key="slot">{label(props.slot, props.photo ? "#FFFFFFD9" : accent)}</VStack>,
    <VStack key="name">{title(props.name, props.photo ? "#FFFFFF" : ink)}</VStack>,
  ];

  if (!props.photo) return card(props.url, ground, text);

  return (
    <ZStack modifiers={[containerBackground("#000000", "widget"), widgetURL(props.url)]}>
      <Image
        modifiers={[
          resizable(),
          widgetAccentedRenderingMode("accentedDesaturated"),
          aspectRatio({ contentMode: "fill" }),
          frame({ minWidth: 0, maxWidth: 2000, minHeight: 0, maxHeight: 2000 }),
          clipped(),
        ]}
        uiImage={props.photo}
      />
      {/* The board's scrims, top and bottom, so white text reads on any photo. */}
      <Rectangle
        modifiers={[
          foregroundStyle({
            type: "linearGradient",
            colors: ["#00000073", "#00000000", "#00000000", "#0000009E"],
            startPoint: { x: 0.5, y: 0 },
            endPoint: { x: 0.5, y: 1 },
          }),
        ]}
      />
      <HStack>
        <VStack
          alignment="leading"
          modifiers={[padding({ top: 15, leading: 16, trailing: 16, bottom: 14 })]}
          spacing={0}
        >
          {text}
        </VStack>
        <Spacer />
      </HStack>
    </ZStack>
  );
};

const weekLayout = (props: LargeWidgetProps, environment: WidgetEnvironment) => {
  "widget";
  const dark = environment.colorScheme === "dark";
  const ground = dark ? "#201E1A" : "#FFFFFF";
  const ink = dark ? "#FBFCFC" : "#181918";
  const muted = dark ? "#AEAAA3" : "#615D56";
  const accent = dark ? "#76C788" : "#336640";
  // Tinted and clear draw every fill in the tint, so the tile drops to the board's 14%.
  const soft =
    environment.widgetRenderingMode === "accented" ? "#FFFFFF24" : dark ? "#2D2B27" : "#ECE7DE";
  // The accent at half strength, as RGBA.
  const ring = dark ? "#76C7888C" : "#33664080";

  if (props.kind === "message") {
    return (
      <HStack modifiers={[containerBackground(ground, "widget"), widgetURL(props.url)]}>
        <VStack alignment="leading" modifiers={[padding({ all: 8 })]}>
          <Spacer />
          <Text modifiers={[font({ size: 22, weight: "semibold" }), foregroundStyle(ink)]}>
            {props.text}
          </Text>
        </VStack>
        <Spacer />
      </HStack>
    );
  }
  const tile = (symbol: "doc.text" | "fork.knife") => (
    <ZStack modifiers={[frame({ width: 20, height: 20 })]}>
      <RoundedRectangle cornerRadius={6} modifiers={[foregroundStyle(soft)]} />
      <Image color={muted} size={11} systemName={symbol} />
    </ZStack>
  );

  return (
    <VStack alignment="leading" modifiers={[containerBackground(ground, "widget")]} spacing={6}>
      <Link destination={props.url}>
        <HStack modifiers={[frame({ height: 26 }), padding({ horizontal: 6 })]} spacing={7}>
          <Image color={accent} size={15} systemName="calendar" />
          <Text modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle(accent)]}>
            {props.title}
          </Text>
          <Spacer />
        </HStack>
      </Link>
      <VStack spacing={0}>
        {props.days.map((day) => (
          <ZStack key={day.key}>
            {/* Under the row: its empty space opens the day, and today carries the ring. */}
            <Link destination={day.url}>
              <RoundedRectangle
                cornerRadius={12}
                modifiers={[
                  // WidgetKit hit-tests a link by what it draws, so the row is filled at 1%.
                  foregroundStyle(dark ? "#201E1A03" : "#FFFFFF03"),
                  ...(day.today
                    ? [
                        strokeBorder({
                          content: ring,
                          style: { lineWidth: 2 },
                          shape: "roundedRectangle",
                          cornerRadius: 12,
                        }),
                      ]
                    : []),
                ]}
              />
            </Link>
            <HStack
              alignment="top"
              modifiers={[padding({ vertical: 7, horizontal: 8 })]}
              spacing={10}
            >
              <Link destination={day.url}>
                <HStack
                  modifiers={[frame({ width: 62, height: 20, alignment: "leading" })]}
                  spacing={4}
                >
                  <Text
                    modifiers={[
                      font({ size: 12, weight: "semibold" }),
                      foregroundStyle(day.today ? accent : muted),
                    ]}
                  >
                    {day.weekday}
                  </Text>
                  <Text modifiers={[font({ size: 15, weight: "semibold" }), foregroundStyle(ink)]}>
                    {day.day}
                  </Text>
                </HStack>
              </Link>
              <VStack alignment="leading" spacing={4}>
                {day.lines.map((line) => (
                  <Link key={line.id} destination={line.url}>
                    <HStack modifiers={[frame({ height: 20 })]} spacing={8}>
                      {line.photo ? (
                        <Image
                          modifiers={[
                            resizable(),
                            widgetAccentedRenderingMode("accentedDesaturated"),
                            aspectRatio({ contentMode: "fill" }),
                            frame({ width: 20, height: 20 }),
                            clipShape("roundedRectangle", 6),
                          ]}
                          uiImage={line.photo}
                        />
                      ) : (
                        tile(line.kind === "note" ? "doc.text" : "fork.knife")
                      )}
                      <Text modifiers={[font({ size: 14 }), foregroundStyle(ink), lineLimit(1)]}>
                        {line.name}
                      </Text>
                      <Spacer />
                      {line.more ? (
                        <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>
                          {line.more}
                        </Text>
                      ) : null}
                    </HStack>
                  </Link>
                ))}
              </VStack>
              <Spacer />
            </HStack>
          </ZStack>
        ))}
      </VStack>
      <Spacer />
    </VStack>
  );
};

// Before the first push a widget is a blank surface that opens the app.
const blank: WidgetMessage = { kind: "message", text: "", url: todayUrl() };

// The widgets exist on iOS only.
const widgets =
  Platform.OS === "ios"
    ? {
        small: createWidget<SmallWidgetProps>("CalendarMeal", mealLayout, blank),
        large: createWidget<LargeWidgetProps>("CalendarWeek", weekLayout, blank),
      }
    : null;

let shown: string | null = null;
// Set by a session end, so a push still on its way when the session ended shows nothing.
let ended = false;
// Bumped by a session end: a refresh started before it writes no photo and pushes nothing.
let generation = 0;
let chain: Promise<void> = Promise.resolve();

function queue(task: () => Promise<void>): Promise<void> {
  chain = chain.then(task).catch((error: unknown) => {
    log.warn({ error }, "Could not update the calendar widgets");
  });

  return chain;
}

function push(timelines: WidgetTimelines) {
  const content = JSON.stringify(timelines);

  if (!widgets || content === shown) return;
  widgets.small.updateTimeline(
    timelines.small.map((entry) => ({ date: new Date(entry.date), props: entry.props }))
  );
  widgets.large.updateTimeline(
    timelines.large.map((entry) => ({ date: new Date(entry.date), props: entry.props }))
  );
  shown = content;
}

/** Starts pushing for a new session. */
export function startCalendarWidgets() {
  ended = false;
}

/**
 * Hands both widgets two weeks from `plan` and writes the photos they show into the shared
 * folder: shown without a photo first, again with it once it is on the device.
 */
export function syncCalendarWidgets(
  plan: Record<string, PlannedItemFromQuery[]>,
  strings: WidgetStrings
): Promise<void> {
  if (!widgets) return Promise.resolve();
  const started = generation;

  return queue(() =>
    renderWithPhotos(
      (photo) => push(calendarWidgetTimelines(plan, Date.now(), strings, photo)),
      () => !ended && started === generation
    )
  );
}

/**
 * Leaves both widgets on `signIn`, the signed-out line, and removes their photos at once, so nothing
 * of the household stays on the Home Screen; a refresh still downloading is dropped, not awaited.
 */
export function clearCalendarWidgets(signIn: string): Promise<void> {
  if (!widgets) return Promise.resolve();
  ended = true;
  generation += 1;
  // The next session's pushes do not queue behind a download the ended one left running.
  chain = Promise.resolve();

  return queue(async () => {
    push(signedOutTimelines({ signIn }));
    clearPhotos();
  });
}
