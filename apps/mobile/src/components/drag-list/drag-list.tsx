import type { ComponentProps, ReactElement, ReactNode, Ref, RefObject } from "react";
import type {
  FlatListProps,
  LayoutChangeEvent,
  ScrollViewImperativeMethods,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import type { PanGesture } from "react-native-gesture-handler";
import type { AnimatedProps, SharedValue } from "react-native-reanimated";
import { createContext, use, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  measure,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useComposedEventHandler,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { lightImpact, mediumImpact } from "@/lib/haptics";
import { timedTo } from "@/lib/motion/timed";

import type { Slot, Target } from "./drop-target";
import type { DragRow, Drop } from "./resolve-drop";
import { landingTop, sectionsOf, targetAt } from "./drop-target";
import { useHeldRows } from "./use-held-rows";

export type { Drop, DragRow };

/** How long a row is held before it lifts, as web's touch drag. */
const HOLD_MS = 250;
/** The band at either end of the visible list that scrolls it, and the speed at its far edge. */
const EDGE = 80;
const EDGE_SPEED = 900;
/** The lifted row's source, as web's. */
const GHOST_OPACITY = 0.5;
/** How long the lifted card takes to settle where it lands. */
const SETTLE_MS = 180;

type AnyRow = DragRow<unknown, unknown>;
type CellLayout = { top: number; height: number; width: number };
type CardLayout = { top: number; height: number; x: number; width: number };
/** The lifted row: where its cell was, and where the list's content started on screen then. */
type Lift = { key: string; from: number; top: number; height: number; origin: number };
type Order = { key: string; heading: boolean; section: string | null }[];
type ScrollHandler = ReturnType<typeof useAnimatedScrollHandler>;
type LayoutAnimation = ComponentProps<typeof Animated.View>["layout"];

/** What a cell needs from its list: where to record its layout, the drag's worklets, and whether it
 * is the lifted row's source or the row a drop just placed (which skips the layout animation). */
type DragState = {
  cells: SharedValue<Record<string, CellLayout>>;
  cards: SharedValue<Record<string, CardLayout>>;
  start: (key: string, from: number) => void;
  move: (translation: number) => void;
  release: () => void;
  canLift: (index: number) => boolean;
  lifted: string | null;
  dropped: string | null;
  layout: LayoutAnimation;
};

/** The page a `nested` list sits in, which it scrolls and holds still while a row is carried. */
type Page = {
  ref: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>;
  offset: SharedValue<number>;
  contentHeight: SharedValue<number>;
  setLocked: (locked: boolean) => void;
};

const DragContext = createContext<DragState | null>(null);

/** A row's gesture, and whether the touch it last saw lifted the row. */
type Handle = { gesture: PanGesture; liftedRef: RefObject<boolean> };

const HandleContext = createContext<Handle | null>(null);
const CardContext = createContext<((event: LayoutChangeEvent) => void) | undefined>(undefined);
const LiftedContext = createContext(false);
const PageContext = createContext<Page | null>(null);

/** True inside the card a drag carries, for its lifted look. */
export const useIsLifted = () => use(LiftedContext);

/** The `onLayout` of a row's visible card inside its cell (a slice of a section's card), which the
 * drop line and the section outline are drawn against. */
export const useDragCard = () => use(CardContext);

/** The part of a row a hold lifts it by; anywhere else (a checkbox) the row stays put. */
export function DragHandle({ children }: { children: ReactElement }) {
  const handle = use(HandleContext);

  return handle ? <GestureDetector gesture={handle.gesture}>{children}</GestureDetector> : children;
}

/** Wraps a row's tap: a short carry ends inside the press's reach, and that press is no tap. */
export function useDragTap() {
  const handle = use(HandleContext);

  return <A extends unknown[]>(onPress: (...args: A) => void) =>
    (...args: A) => {
      if (!handle?.liftedRef.current) onPress(...args);
    };
}

/** An item cell's hold-then-pan, decided on the UI thread. */
function ItemHandle({
  row,
  index,
  drag,
  children,
}: {
  row: AnyRow;
  index: number;
  drag: DragState;
  children: ReactNode;
}) {
  const liftedRef = useRef(false);
  const touched = (lifted: boolean) => {
    liftedRef.current = lifted;
  };
  const gesture = usePanGesture({
    enabled: drag.canLift(index),
    activateAfterLongPress: HOLD_MS,
    onBegin: () => {
      "worklet";
      scheduleOnRN(touched, false);
    },
    onActivate: () => {
      "worklet";
      scheduleOnRN(touched, true);
      drag.start(row.key, index);
    },
    onUpdate: (event) => {
      "worklet";
      drag.move(event.translationY);
    },
    onDeactivate: () => {
      "worklet";
      drag.release();
    },
  });

  return <HandleContext value={{ gesture, liftedRef }}>{children}</HandleContext>;
}

/** A row's cell: records where it is laid out, fades as the lifted row's source, and gives an item
 * its handle. FlatList's `CellRendererComponent`, and each row of a nested list. */
function DragCell({
  item: row,
  index,
  onLayout,
  style,
  children,
}: {
  item: AnyRow;
  index: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const drag = use(DragContext);
  const { key } = row;
  const cells = drag?.cells;
  const cards = drag?.cards;

  // A cell that leaves the window takes its layout with it, so only drawn rows are hit.
  useEffect(() => {
    if (!cells || !cards) return;

    return () =>
      scheduleOnUI(() => {
        "worklet";
        cells.modify((all) => {
          "worklet";
          delete all[key];

          return all;
        });
        cards.modify((all) => {
          "worklet";
          delete all[key];

          return all;
        });
      });
  }, [cells, cards, key]);

  if (!drag || !cells || !cards) return children;
  const recordCell = ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
    scheduleOnUI(() => {
      "worklet";
      cells.modify((all) => {
        "worklet";
        all[key] = { top: layout.y, height: layout.height, width: layout.width };

        return all;
      });
    });
  const recordCard = ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
    scheduleOnUI(() => {
      "worklet";
      cards.modify((all) => {
        "worklet";
        all[key] = { top: layout.y, height: layout.height, x: layout.x, width: layout.width };

        return all;
      });
    });

  return (
    <Animated.View
      layout={key === drag.dropped ? undefined : drag.layout}
      style={[style, key === drag.lifted ? { opacity: GHOST_OPACITY } : null]}
      onLayout={(event) => {
        recordCell(event);
        onLayout?.(event);
      }}
    >
      <CardContext value={recordCard}>
        {row.kind === "item" ? (
          <ItemHandle drag={drag} index={index} row={row}>
            {children}
          </ItemHandle>
        ) : (
          children
        )}
      </CardContext>
    </Animated.View>
  );
}

/** The list's scroll view with the drag's layer drawn over its rows, in content coordinates. */
function LayerScrollView({
  layer,
  children,
  ...props
}: ComponentProps<typeof ScrollView> & { layer: ReactNode }) {
  return (
    <ScrollView {...props}>
      {children}
      {layer}
    </ScrollView>
  );
}

/** The card a drag carries, over the rows, following the finger. */
function LiftedCard({
  top,
  opacity,
  children,
}: {
  top: SharedValue<number>;
  opacity: SharedValue<number>;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: top.get() }],
  }));

  return (
    <Animated.View
      className="absolute inset-x-0 top-0 shadow-lg"
      pointerEvents="none"
      style={style}
    >
      <LiftedContext value>{children}</LiftedContext>
    </Animated.View>
  );
}

/** Where the dragged row would land and the section it would land in. */
function DropMarks({ target }: { target: SharedValue<Target | null> }) {
  const line = useAnimatedStyle(() => {
    const at = target.get()?.line;

    return at
      ? { opacity: 1, left: at.x, width: at.width, transform: [{ translateY: at.y - 1.5 }] }
      : { opacity: 0 };
  });
  const box = useAnimatedStyle(() => {
    const at = target.get()?.box;

    return at
      ? {
          opacity: 1,
          left: at.x,
          width: at.width,
          height: at.height,
          transform: [{ translateY: at.top }],
        }
      : { opacity: 0 };
  });

  return (
    <>
      <Animated.View className="border-accent absolute top-0 rounded-3xl border-2" style={box} />
      <Animated.View className="bg-accent absolute top-0 h-[3px] rounded-full" style={line} />
    </>
  );
}

/** The scroll handle a `DragList`'s `ref` gives. */
export type DragListHandle = Pick<FlatList, "scrollToOffset">;

type DragListProps<H, T> = Omit<
  FlatListProps<DragRow<H, T>>,
  | "data"
  | "renderItem"
  | "keyExtractor"
  | "onScroll"
  | "CellRendererComponent"
  | "renderScrollComponent"
> & {
  rows: DragRow<H, T>[];
  /** `index` counts in the rows shown, which a drag holds still. */
  renderHeading: (heading: H, index: number) => ReactNode;
  /** The row; it marks the part a hold lifts it by with `DragHandle`. */
  renderItem: (item: T) => ReactNode;
  /** Fired after a drop that moved the row, counted in the rows shown at the lift. The list shows
   * `drop.rows` until `rows` changes; returning false puts the row back instead. */
  onDrop: (drop: Drop<H, T>) => boolean | void;
  /** Told when a row is lifted and when it is let go. */
  onHeldChange?: (held: boolean) => void;
  /** The section a heading opens, outlined while a row is over it; null for one that takes no drop.
   * By default each heading opens its own. */
  sectionOf?: (heading: H, key: string) => string | null;
  /** Whether an item can be lifted; all can by default. */
  canLift?: (item: T) => boolean;
  /** False where a drop lands by a rule rather than where the line would show it. */
  dropLine?: boolean;
  /** The bars over the list's ends, inside which auto-scroll starts; by default its `contentInset`.
   * The top one is also where scrolling up stops. */
  edgeInsets?: { top?: number; bottom?: number };
  itemLayoutAnimation?: LayoutAnimation;
  onScroll?: ScrollHandler;
  /** Laid out at full height inside a `DragScrollView`, which scrolls instead. */
  nested?: boolean;
  ref?: Ref<DragListHandle>;
  /** Holds the rows shown, which a scroll by index counts in. */
  shownRef?: { current: DragRow<H, T>[] };
};

/** FlatList behind a function: `createAnimatedComponent`'s FlatList form is deprecated for
 * `Animated.FlatList`, which overrides `CellRendererComponent`. */
function RowFlatList(props: ComponentProps<typeof FlatList> & { ref?: Ref<FlatList> }) {
  return <FlatList {...props} />;
}

// createAnimatedComponent drops FlatList's item type; the rows' type is restored here.
const RowList = Animated.createAnimatedComponent(RowFlatList) as <R>(
  props: AnimatedProps<FlatListProps<R>> & { ref?: Ref<FlatList<R>> }
) => ReactNode;

/** A list whose items a hold lifts and a drag carries over still rows: a line shows where it lands
 * and its section is outlined, and nothing moves until the drop. Headings never move. */
export function DragList<H, T>({
  rows,
  renderHeading,
  renderItem,
  onDrop,
  onHeldChange,
  sectionOf,
  canLift,
  dropLine = true,
  edgeInsets,
  itemLayoutAnimation,
  nested = false,
  ref,
  shownRef,
  onContentSizeChange,
  ...rest
}: DragListProps<H, T>) {
  const held = useHeldRows(rows, onDrop);
  const { shown } = held;
  const outer = use(PageContext);
  const page = nested ? outer : null;
  const [lifted, setLifted] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const listRef = useAnimatedRef<FlatList>();
  const layerRef = useAnimatedRef<View>();
  const cells = useSharedValue<Record<string, CellLayout>>({});
  const cards = useSharedValue<Record<string, CardLayout>>({});
  const order = useSharedValue<Order>([]);
  const lift = useSharedValue<Lift | null>(null);
  const dragging = useSharedValue(false);
  // How far the finger has moved since the lift; a sheet's gestures count from its own top.
  const travel = useSharedValue(0);
  const cardTop = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const target = useSharedValue<Target | null>(null);
  const section = useSharedValue<string | null>(null);
  const contentHeight = useSharedValue(0);
  const insetTop = edgeInsets?.top ?? rest.contentInset?.top ?? 0;
  const contentInsetBottom = rest.contentInset?.bottom ?? 0;
  const insetBottom = edgeInsets?.bottom ?? contentInsetBottom;

  useImperativeHandle(ref, () => ({
    scrollToOffset: (params) => listRef.current?.scrollToOffset(params),
  }));

  // The rows in the order a drag counts in, with each one's section, for the UI thread.
  const sections = sectionsOf(shown, sectionOf);

  useEffect(() => {
    if (shownRef) shownRef.current = shown;
    order.set(
      shown.map((row, index) => ({
        key: row.key,
        heading: row.kind === "heading",
        section: sections[index] ?? null,
      }))
    );
  });

  // Lift and drop reach React through the latest render, as the worklets that call them are kept.
  const latestRef = useRef({
    lifted: (_key: string) => {},
    finished: (_key: string, _from: number, _gap: number | null) => {},
  });

  // The drop's commit placed its row without the layout animation; later changes animate again.
  useEffect(() => {
    if (dropped) setDropped(null);
  }, [dropped]);

  const slotsNow = () => {
    "worklet";
    const laid = cells.get();
    const drawn = cards.get();

    return order.get().map(({ key, heading, section }): Slot => {
      const cell = laid[key];

      if (!cell) return null;

      return {
        top: cell.top,
        height: cell.height,
        heading,
        section,
        card: drawn[key] ?? { top: 0, height: cell.height, x: 0, width: cell.width },
      };
    });
  };

  const frame = useFrameCallback(({ timeSincePreviousFrame }) => {
    "worklet";
    const held = lift.get();
    const layer = measure(layerRef);
    const box = page ? measure(page.ref) : measure(listRef);

    if (!held || !dragging.get() || !layer || !box) return;

    // Frame-driven auto-scroll, faster the deeper the card's middle is in an end's band.
    const y = held.origin + held.top + travel.get() + held.height / 2;
    const top = box.pageY + (page ? 0 : insetTop);
    const bottom = box.pageY + box.height - (page ? 0 : insetBottom);
    const depth =
      y < top + EDGE
        ? -(top + EDGE - y) / EDGE
        : y > bottom - EDGE
          ? (y - bottom + EDGE) / EDGE
          : 0;
    let shift = 0;

    if (depth !== 0) {
      // A FlatList's offset is where its content starts on screen; a page tracks its own.
      const offset = page ? page.offset.get() : box.pageY - layer.pageY;
      const max =
        (page ? page.contentHeight.get() : contentHeight.get() + contentInsetBottom) - box.height;
      const speed = Math.max(-1, Math.min(1, depth)) * EDGE_SPEED;
      const next = Math.max(
        page ? 0 : -insetTop,
        Math.min(max, offset + (speed * (timeSincePreviousFrame ?? 16)) / 1000)
      );

      if (Math.abs(next - offset) > 0.1) {
        if (page) scrollTo(page.ref, 0, next, false);
        else scrollTo(listRef, 0, next, false);
        shift = next - offset;
      }
    }

    // The card's top in the content, which the list scrolled under by `shift` this frame.
    const cardY = held.top + travel.get() + held.origin - layer.pageY + shift;
    // A loop, not a map: the React Compiler hoists a capture-free callback out of the worklet.
    const sections: (string | null)[] = [];

    for (const row of order.get()) sections.push(row.section);
    const now = targetAt(slotsNow(), sections, held.from, cardY + held.height / 2);

    cardTop.set(cardY);
    target.set(dropLine || !now ? now : { ...now, line: null });
    if (now && now.section !== section.get()) {
      section.set(now.section);
      scheduleOnRN(lightImpact);
    }
  }, false);

  useEffect(() => {
    latestRef.current = {
      lifted: (key) => {
        mediumImpact();
        frame.setActive(true);
        held.lift();
        setLifted(key);
        setDropped(null);
        page?.setLocked(true);
        onHeldChange?.(true);
      },
      finished: (key, from, gap) => {
        const kept = held.drop(from, gap);

        if (kept) mediumImpact();
        frame.setActive(false);
        setLifted(null);
        setDropped(kept ? key : null);
        page?.setLocked(false);
        onHeldChange?.(false);
      },
    };
  });

  const onLifted = (key: string) => latestRef.current.lifted(key);
  const onFinished = (key: string, from: number, gap: number | null) =>
    latestRef.current.finished(key, from, gap);

  const drag: DragState = {
    cells,
    cards,
    lifted,
    dropped,
    layout: itemLayoutAnimation,
    canLift: (index) => {
      const row = shown[index];

      return row?.kind === "item" && (canLift?.(row.value) ?? true);
    },
    start: (key, from) => {
      "worklet";
      const layer = measure(layerRef);
      const cell = cells.get()[key];

      if (lift.get() || !layer || !cell) return;
      lift.set({ key, from, top: cell.top, height: cell.height, origin: layer.pageY });
      dragging.set(true);
      travel.set(0);
      cardTop.set(cell.top);
      cardOpacity.set(1);
      target.set(null);
      section.set(order.get()[from]?.section ?? null);
      scheduleOnRN(onLifted, key);
    },
    move: (translation) => {
      "worklet";
      travel.set(translation);
    },
    release: () => {
      "worklet";
      const held = lift.get();

      if (!held || !dragging.get()) return;
      dragging.set(false);
      const landing = target.get();
      const gap = landing?.gap ?? null;
      const done = () => {
        "worklet";
        lift.set(null);
        scheduleOnRN(onFinished, held.key, held.from, gap);
      };

      target.set(null);
      // Without a line the row lands by a rule, not where the card is: it fades there instead.
      if (landing && !dropLine) cardOpacity.set(timedTo(0, SETTLE_MS, { keep: true }, done));
      else cardTop.set(timedTo(landingTop(slotsNow(), landing, held.from), SETTLE_MS, {}, done));
    },
  };

  const liftedRow = lifted ? shown.find((row) => row.key === lifted) : undefined;
  const renderRow = (row: DragRow<H, T>, index: number) =>
    row.kind === "heading" ? renderHeading(row.value, index) : renderItem(row.value);
  const layer = (
    <Animated.View
      ref={layerRef}
      className="absolute inset-x-0 top-0 h-0"
      collapsable={false}
      pointerEvents="none"
    >
      {liftedRow?.kind === "item" ? (
        <LiftedCard opacity={cardOpacity} top={cardTop}>
          {renderItem(liftedRow.value)}
        </LiftedCard>
      ) : null}
      {/* Over the card, which the finger keeps over the gap. */}
      <DropMarks target={target} />
    </Animated.View>
  );

  if (nested) {
    return (
      <DragContext value={drag}>
        <View>
          {shown.map((row, index) => (
            <DragCell key={row.key} index={index} item={row}>
              {renderRow(row, index)}
            </DragCell>
          ))}
          {layer}
        </View>
      </DragContext>
    );
  }

  return (
    <DragContext value={drag}>
      <RowList
        ref={listRef}
        {...rest}
        CellRendererComponent={DragCell}
        data={shown}
        keyExtractor={(row) => row.key}
        renderItem={({ index }) => renderRow(shown[index]!, index)}
        renderScrollComponent={(props) => <LayerScrollView {...props} layer={layer} />}
        onContentSizeChange={(width, height) => {
          contentHeight.set(height);
          onContentSizeChange?.(width, height);
        }}
      />
    </DragContext>
  );
}

/** The scroll handle a `DragScrollView`'s `ref` gives. */
export type DragScrollHandle = Pick<ScrollViewImperativeMethods, "scrollTo">;

/** The page `nested` drag lists sit in: a carried row scrolls it, and it holds still meanwhile. */
export function DragScrollView({
  ref,
  onScroll,
  onContentSizeChange,
  scrollEnabled,
  children,
  ...props
}: Omit<ScrollViewProps, "onScroll"> & { ref?: Ref<DragScrollHandle>; onScroll?: ScrollHandler }) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const offset = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const [locked, setLocked] = useState(false);
  const track = useAnimatedScrollHandler((event) => {
    offset.set(event.contentOffset.y);
  });
  const handler = useComposedEventHandler([track, onScroll ?? null]);

  useImperativeHandle(ref, () => ({
    scrollTo: (to) => scrollRef.current?.scrollTo(to),
  }));

  return (
    <PageContext value={{ ref: scrollRef, offset, contentHeight, setLocked }}>
      <Animated.ScrollView
        ref={scrollRef}
        {...props}
        scrollEnabled={locked ? false : scrollEnabled}
        onContentSizeChange={(width, height) => {
          contentHeight.set(height);
          onContentSizeChange?.(width, height);
        }}
        onScroll={handler}
      >
        {children}
      </Animated.ScrollView>
    </PageContext>
  );
}
