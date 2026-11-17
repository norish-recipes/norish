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
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useComposedEventHandler,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { mediumImpact } from "@/lib/haptics";

import type { Box, Target } from "./drop-target";
import type { DragRow, Drop } from "./resolve-drop";
import type { Page } from "./use-drag-engine";
import { sectionsOf } from "./drop-target";
import { useDragEngine } from "./use-drag-engine";
import { useHeldRows } from "./use-held-rows";

export type { Drop, DragRow };

/** How long a row is held before it lifts, as web's touch drag. */
const HOLD_MS = 250;
/** The lifted row's source, as web's. */
const GHOST_OPACITY = 0.5;

type AnyRow = DragRow<unknown, unknown>;
type ScrollHandler = ReturnType<typeof useAnimatedScrollHandler>;
type LayoutAnimation = ComponentProps<typeof Animated.View>["layout"];

/** What a cell needs from its list: where to record its layout, the drag's worklets, and whether it
 * is the lifted row's source or the row a drop just placed (which skips the layout animation). */
type DragState = {
  cells: Boxes;
  cards: Boxes;
  start: (key: string) => void;
  move: (key: string, translation: number) => void;
  release: (key: string, canceled: boolean) => void;
  canLift: (index: number) => boolean;
  lifted: string | null;
  dropped: string | null;
  layout: LayoutAnimation;
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

/** A row's pressable part, which a hold lifts it by: a short carry ends inside the press's reach,
 * and that press is no tap. */
export function DragPressable({ onPress, ...props }: ComponentProps<typeof Pressable>) {
  const handle = use(HandleContext);

  return (
    <DragHandle>
      <Pressable
        {...props}
        onPress={(event) => {
          if (!handle?.liftedRef.current) onPress?.(event);
        }}
      />
    </DragHandle>
  );
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
  const { key } = row;
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
      drag.start(key);
    },
    onUpdate: (event) => {
      "worklet";
      drag.move(key, event.translationY);
    },
    // Failed or cancelled (the app left, a system gesture): the row goes back.
    onDeactivate: (event) => {
      "worklet";
      drag.release(key, event.canceled);
    },
  });

  return <HandleContext value={{ gesture, liftedRef }}>{children}</HandleContext>;
}

type Boxes = SharedValue<Record<string, Box>>;

/** Sets a row's box in `into` on the UI thread, or with null deletes it. */
function writeBox(into: Boxes, key: string, box: Box | null) {
  scheduleOnUI(() => {
    "worklet";
    into.modify((all) => {
      "worklet";
      if (box) all[key] = box;
      else delete all[key];

      return all;
    });
  });
}

/** An `onLayout` that records the view's box, in its parent, as row `key`'s in `into`. */
const recordInto =
  (into: Boxes, key: string) =>
  ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
    writeBox(into, key, { top: layout.y, height: layout.height, x: layout.x, width: layout.width });

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

    return () => {
      writeBox(cells, key, null);
      writeBox(cards, key, null);
    };
  }, [cells, cards, key]);

  if (!drag || !cells || !cards) return children;
  const recordCard = recordInto(cards, key);

  return (
    <Animated.View
      layout={key === drag.dropped ? undefined : drag.layout}
      style={[style, key === drag.lifted ? { opacity: GHOST_OPACITY } : null]}
      onLayout={(event) => {
        recordInto(cells, key)(event);
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

/** The list's scroll view with the drag's overlay drawn over its rows, in content coordinates. */
function OverlayScrollView({
  overlay,
  children,
  ...props
}: ComponentProps<typeof ScrollView> & { overlay: ReactNode }) {
  return (
    <ScrollView {...props}>
      {children}
      {overlay}
    </ScrollView>
  );
}

/** The card a drag carries, over the rows, following the finger. */
function LiftedCard({ top, children }: { top: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: top.get() }] }));

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
  const outline = useAnimatedStyle(() => {
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
      <Animated.View
        className="border-accent absolute top-0 rounded-3xl border-2"
        style={outline}
      />
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
  /** Where a drop lands by a rule rather than where the card is: its gap in `rows` (the rows
   * shown), or null where it changes nothing. The list then draws no line, only the outline. */
  landAt?: (drop: Drop<H, T>, rows: DragRow<H, T>[]) => number | null;
  /** The bars over the list's ends, inside which auto-scroll starts (none by default); the top one
   * is also where scrolling up stops. */
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
  landAt,
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
  // The rows in the order a drag counts in, with each one's section, for the UI thread.
  const sections = sectionsOf(shown, sectionOf);
  const { listRef, layerRef, cells, cards, cardTop, target, contentHeight, start, move, release } =
    useDragEngine({
      order: shown.map((row, index) => ({
        key: row.key,
        heading: row.kind === "heading",
        section: sections[index] ?? null,
      })),
      page,
      insets: { top: edgeInsets?.top ?? 0, bottom: edgeInsets?.bottom ?? 0 },
      events: {
        lifted: (key) => {
          mediumImpact();
          held.lift();
          setLifted(key);
          setDropped(null);
        },
        finished: (key, gap) => {
          const kept = held.drop(key, gap);

          if (kept) mediumImpact();
          setLifted(null);
          setDropped(kept ? key : null);
        },
        rule: landAt
          ? (key, gap) => {
              const drop = held.dropOf(key, gap);

              return drop && landAt(drop, held.shown);
            }
          : undefined,
      },
    });

  useImperativeHandle(ref, () => ({
    scrollToOffset: (params) => listRef.current?.scrollToOffset(params),
  }));

  useEffect(() => {
    if (shownRef) shownRef.current = shown;
  });

  // The drop's commit placed its row without the layout animation; later changes animate again.
  useEffect(() => {
    if (dropped) setDropped(null);
  }, [dropped]);

  // Held from the lift until it is let go or the list goes, so a page is never left locked.
  const heldChanged = useEffectEvent((isHeld: boolean) => {
    page?.setLocked(isHeld);
    onHeldChange?.(isHeld);
  });

  useEffect(() => {
    if (!lifted) return;
    heldChanged(true);

    return () => heldChanged(false);
  }, [lifted]);

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
    start,
    move,
    release,
  };

  const liftedRow = lifted ? shown.find((row) => row.key === lifted) : undefined;
  const renderRow = (row: DragRow<H, T>, index: number) =>
    row.kind === "heading" ? renderHeading(row.value, index) : renderItem(row.value);
  const overlay = (
    <Animated.View
      ref={layerRef}
      className="absolute inset-x-0 top-0 h-0"
      collapsable={false}
      pointerEvents="none"
    >
      {liftedRow?.kind === "item" ? (
        <LiftedCard top={cardTop}>{renderItem(liftedRow.value)}</LiftedCard>
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
          {overlay}
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
        renderScrollComponent={(props) => <OverlayScrollView {...props} overlay={overlay} />}
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
