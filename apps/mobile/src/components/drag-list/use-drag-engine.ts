import type { FlatList, View } from "react-native";
import type Animated from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useEffect, useRef } from "react";
import {
  measure,
  scrollTo,
  useAnimatedRef,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { lightImpact } from "@/lib/haptics";
import { EASE_OUT } from "@/lib/motion/ease";
import { timedTo } from "@/lib/motion/timed";

import type { Box, Place, Slot, Span, Target } from "./drop-target";
import { landingTop, placeAt, sectionBox, targetAt } from "./drop-target";

/** The band at either end of the visible list that scrolls it, and the speed at its far edge. */
const EDGE = 80;
const EDGE_SPEED = 900;
/** How long the lifted card takes to settle where it lands; the rows are done making room by then. */
const SETTLE_MS = 180;

/** How long the rows, and the section's outline, take to make room. */
export const SHIFT_MS = 150;

/** The lifted row: where its cell was, and where the list's content started on screen then. */
type Lift = Span & { key: string; origin: number };
/** The rows a drag counts in, with each one's section. */
export type Order = { key: string; heading: boolean; section: string | null }[];

/** The page a `nested` list sits in, which it scrolls and holds still while a row is carried. */
export type Page = {
  ref: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>;
  offset: SharedValue<number>;
  contentHeight: SharedValue<number>;
  setLocked: (locked: boolean) => void;
};

/** What the drag tells React, on the JS thread: `placed` is where the rows make room for the held
 * row. `rule` gives where a drop lands by a rule. */
type Events = {
  lifted: (key: string) => void;
  placed: (place: Place | null) => void;
  finished: (key: string, gap: number | null) => void;
  rule?: (key: string, gap: number) => number | null;
};

const samePlace = (a: Place | null, b: Place | null) => {
  "worklet";

  return a === b || (!!a && !!b && a.gap === b.gap && a.from === b.from && a.offset === b.offset);
};

const sameBox = (a: Box | null, b: Box | null) => {
  "worklet";

  return (
    a === b ||
    (!!a && !!b && a.top === b.top && a.height === b.height && a.x === b.x && a.width === b.width)
  );
};

/** The drag on the UI thread: the lift, the frame loop that carries the card and auto-scrolls,
 * and the settle before a drop commits. `insets` are the bars over the list's ends. */
export function useDragEngine({
  order,
  page,
  insets,
  events,
}: {
  order: Order;
  page: Page | null;
  insets: { top: number; bottom: number };
  events: Events;
}) {
  const listRef = useAnimatedRef<FlatList>();
  const layerRef = useAnimatedRef<View>();
  const cells = useSharedValue<Record<string, Box>>({});
  const cards = useSharedValue<Record<string, Box>>({});
  const rowsNow = useSharedValue<Order>([]);
  const lift = useSharedValue<Lift | null>(null);
  const dragging = useSharedValue(false);
  // How far the finger has moved since the lift; a sheet's gestures count from its own top.
  const travel = useSharedValue(0);
  const cardTop = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const target = useSharedValue<Target | null>(null);
  // The gap the finger last pointed at, the gap the rows make room at (a rule's answer to it), and
  // where they make room.
  const aimed = useSharedValue<number | null>(null);
  const landGap = useSharedValue<number | null>(null);
  const place = useSharedValue<Place | null>(null);
  // The section's outline: where it is headed, and its animated top and height.
  const outline = useSharedValue<Box | null>(null);
  const outlineTop = useSharedValue(0);
  const outlineHeight = useSharedValue(0);
  // The section the card was last over, which a haptic marks leaving.
  const overSection = useSharedValue<string | null>(null);
  const contentHeight = useSharedValue(0);
  const ruled = events.rule !== undefined;

  useEffect(() => {
    rowsNow.set(order);
  });

  // The worklets reach React through the latest render's events, as they are kept.
  const eventsRef = useRef<Events>(events);
  const onLifted = (key: string) => eventsRef.current.lifted(key);
  const onPlaced = (at: Place | null) => eventsRef.current.placed(at);
  const onFinished = (key: string, gap: number | null) => eventsRef.current.finished(key, gap);

  const slotsNow = () => {
    "worklet";
    const laid = cells.get();
    const drawn = cards.get();

    return rowsNow.get().map(({ key, heading, section }): Slot => {
      const cell = laid[key];

      if (!cell) return null;

      return {
        top: cell.top,
        height: cell.height,
        heading,
        section,
        card: drawn[key] ?? { ...cell, top: 0 },
      };
    });
  };

  /** The row's index in the rows the drag counts in; the UI thread's index can be a render old. */
  const indexOf = (key: string) => {
    "worklet";
    const all = rowsNow.get();

    for (let index = 0; index < all.length; index++) if (all[index]!.key === key) return index;

    return -1;
  };

  const start = (key: string) => {
    "worklet";
    const content = measure(layerRef);
    const cell = cells.get()[key];

    if (lift.get() || !content || !cell) return;
    lift.set({ key, top: cell.top, height: cell.height, origin: content.pageY });
    dragging.set(true);
    travel.set(0);
    cardTop.set(cell.top);
    cardOpacity.set(1);
    target.set(null);
    aimed.set(null);
    landGap.set(null);
    place.set(null);
    outline.set(null);
    overSection.set(rowsNow.get()[indexOf(key)]?.section ?? null);
    scheduleOnRN(onLifted, key);
  };

  /** Tells React where the rows make room, when that changed. */
  const placeRows = (at: Place | null) => {
    "worklet";
    if (samePlace(at, place.get())) return;
    place.set(at);
    scheduleOnRN(onPlaced, at);
  };

  // Once shown, the outline slides with the rows; it appears where it is.
  const drawOutline = (box: Box | null) => {
    "worklet";
    const was = outline.get();

    if (sameBox(box, was)) return;
    outline.set(box);
    if (!box) return;
    outlineTop.set(was ? timedTo(box.top, SHIFT_MS, { easing: EASE_OUT }) : box.top);
    outlineHeight.set(was ? timedTo(box.height, SHIFT_MS, { easing: EASE_OUT }) : box.height);
  };

  // A rule's answer for the gap the finger still points at.
  const aimRuled = (key: string, gap: number, landed: number | null) => {
    "worklet";
    if (lift.get()?.key === key && aimed.get() === gap) landGap.set(landed);
  };

  const onAim = (key: string, gap: number) =>
    scheduleOnUI(aimRuled, key, gap, eventsRef.current.rule?.(key, gap) ?? null);

  // Another finger's row is not the one carried.
  const move = (key: string, translation: number) => {
    "worklet";
    if (lift.get()?.key === key) travel.set(translation);
  };

  // The card slides to where the row lands, or back to its place, then the drop commits.
  const settle = (key: string, gap: number | null) => {
    "worklet";
    const carried = lift.get();

    if (carried?.key !== key) return;
    const done = () => {
      "worklet";
      lift.set(null);
      scheduleOnRN(onFinished, key, gap);
    };

    const slots = slotsNow();
    const from = indexOf(key);
    const top = landingTop(slots, gap, from, carried);

    // The rows make room where it lands, or close up again, while the card settles.
    placeRows(placeAt(slots, gap, from, carried));
    // A landing off screen has no top to slide to: the card fades where it is.
    if (top === null) cardOpacity.set(timedTo(0, SETTLE_MS, {}, done));
    else cardTop.set(timedTo(top, SETTLE_MS, {}, done));
  };

  const onRuled = (key: string, gap: number) =>
    scheduleOnUI(settle, key, eventsRef.current.rule?.(key, gap) ?? null);

  const release = (key: string, canceled: boolean) => {
    "worklet";
    if (lift.get()?.key !== key || !dragging.get()) return;
    dragging.set(false);
    const gap = canceled ? null : (target.get()?.gap ?? null);

    target.set(null);
    drawOutline(null);
    // A list with a rule asks it where the row lands first.
    if (ruled && gap !== null) scheduleOnRN(onRuled, key, gap);
    else settle(key, gap);
  };

  const loop = useFrameCallback(({ timeSincePreviousFrame }) => {
    "worklet";
    const carried = lift.get();
    const content = measure(layerRef);
    const viewport = page ? measure(page.ref) : measure(listRef);

    if (!carried || !dragging.get() || !content || !viewport) return;
    // The source cell left the list's window and took its gesture: the drag ends as a cancel.
    if (!cells.get()[carried.key]) {
      release(carried.key, true);

      return;
    }

    // Frame-driven auto-scroll, faster the deeper the card's middle is in an end's band.
    const y = carried.origin + carried.top + travel.get() + carried.height / 2;
    const top = viewport.pageY + (page ? 0 : insets.top);
    const bottom = viewport.pageY + viewport.height - (page ? 0 : insets.bottom);
    const depth =
      y < top + EDGE
        ? -(top + EDGE - y) / EDGE
        : y > bottom - EDGE
          ? (y - bottom + EDGE) / EDGE
          : 0;
    let shift = 0;

    if (depth !== 0) {
      // A FlatList's offset is where its content starts on screen; a page tracks its own.
      const offset = page ? page.offset.get() : viewport.pageY - content.pageY;
      const max = (page ? page.contentHeight.get() : contentHeight.get()) - viewport.height;
      const speed = Math.max(-1, Math.min(1, depth)) * EDGE_SPEED;
      const next = Math.max(
        page ? 0 : -insets.top,
        Math.min(max, offset + (speed * (timeSincePreviousFrame ?? 16)) / 1000)
      );

      if (Math.abs(next - offset) > 0.1) {
        if (page) scrollTo(page.ref, 0, next, false);
        else scrollTo(listRef, 0, next, false);
        shift = next - offset;
      }
    }

    // The card's top in the content, which the list scrolled under by `shift` this frame.
    const cardY = carried.top + travel.get() + carried.origin - content.pageY + shift;
    const slots = slotsNow();
    const from = indexOf(carried.key);
    const now = targetAt(slots, cardY + carried.height / 2);
    const gap = now?.gap ?? null;

    cardTop.set(cardY);
    target.set(now);
    if (gap !== aimed.get()) {
      aimed.set(gap);
      // A list with a rule asks it where the row lands; the rows stay put until it answers.
      if (ruled && gap !== null) scheduleOnRN(onAim, carried.key, gap);
      else landGap.set(gap);
    }
    const at = placeAt(slots, landGap.get(), from, carried);

    placeRows(at);
    drawOutline(now ? sectionBox(slots, now.section, from, at) : null);
    if (now && now.section !== overSection.get()) {
      overSection.set(now.section);
      scheduleOnRN(lightImpact);
    }
  }, false);

  useEffect(() => {
    eventsRef.current = {
      lifted: (key) => {
        loop.setActive(true);
        events.lifted(key);
      },
      placed: events.placed,
      finished: (key, gap) => {
        loop.setActive(false);
        events.finished(key, gap);
      },
      rule: events.rule,
    };
  });

  return {
    listRef,
    layerRef,
    cells,
    cards,
    card: { top: cardTop, opacity: cardOpacity },
    outline: { box: outline, top: outlineTop, height: outlineHeight },
    contentHeight,
    start,
    move,
    release,
  };
}
