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
  useSyncExternalStore,
} from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useComposedEventHandler,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { mediumImpact } from "@/lib/haptics";
import { EASE_OUT_CSS } from "@/lib/motion/ease";

import type { Box, Place } from "./drop-target";
import type { DragRow, Drop } from "./resolve-drop";
import type { Page } from "./use-drag-engine";
import { sectionsOf, shiftOf } from "./drop-target";
import { SHIFT_MS, useDragEngine } from "./use-drag-engine";
import { useHeldRows } from "./use-held-rows";

export type { Drop, DragRow };

/** How long a row is held before it lifts, as web's touch drag. */
const HOLD_MS = 250;
/** The lifted row's source, its after-image where it lands, as web's. */
const GHOST_OPACITY = 0.5;
/** Rows make room by a CSS transition of a transform React renders, so the drop's commit can clear
 * it with the new order in one commit: the transition is detached before React commits. */
const MAKING_ROOM = {
  transitionProperty: "transform",
  transitionDuration: SHIFT_MS,
  transitionTimingFunction: EASE_OUT_CSS,
} as const;

/** Where the rows make room, outside React state: each cell subscribes to its own shift, so a new
 * gap re-renders only the cells it moves. */
function placeStore() {
  let place: Place | null = null;
  const listeners = new Set<() => void>();

  return {
    get: () => place,
    set: (next: Place | null) => {
      place = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
}

type Places = ReturnType<typeof placeStore>;

type AnyRow = DragRow<unknown, unknown>;
type ScrollHandler = ReturnType<typeof useAnimatedScrollHandler>;
type LayoutAnimation = ComponentProps<typeof Animated.View>["layout"];

/** What a cell needs from its list: where it records its layout, the drag's worklets, the lifted
 * row, where rows make room for it and whether they slide, and whether this commit is a drop's. */
type DragState = {
  cells: Boxes;
  cards: Boxes;
  start: (key: string) => void;
  move: (key: string, translation: number) => void;
  release: (key: string, canceled: boolean) => void;
  canLift: (index: number) => boolean;
  lifted: string | null;
  places: Places;
  /** Rows slide: from the lift until the drop's commit, or until a refused drop's rows are back. */
  moving: boolean;
  dropped: boolean;
  /** Rows jump instead of sliding, for Reduce Motion. */
  still: boolean;
  layout: LayoutAnimation;
};

const DragContext = createContext<DragState | null>(null);
const NO_PLACES = placeStore();

/** A row's gesture, and whether the touch it last saw lifted the row. */
type Handle = { gesture: PanGesture; liftedRef: RefObject<boolean> };

const HandleContext = createContext<Handle | null>(null);
const CardContext = createContext<((event: LayoutChangeEvent) => void) | undefined>(undefined);

/** The lifted row's two drawings: the card the finger carries, and the faded one where it lands. */
type Lift = "carried" | "ghost" | null;
const LiftedContext = createContext<Lift>(null);
const PageContext = createContext<Page | null>(null);

/** True inside the lifted row's carried card and its faded copy, for the lifted (pill) look. */
export const useIsLifted = () => use(LiftedContext) !== null;
/** True only inside the card the finger carries. */
export const useIsCarried = () => use(LiftedContext) === "carried";

/** The `onLayout` of a row's visible card inside its cell (a slice of a section's card), which the
 * section outline is drawn around. */
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
  // The worklets capture these alone, not the whole drag state (its layout animation can't copy).
  const { start, move, release } = drag;
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
      start(key);
    },
    onUpdate: (event) => {
      "worklet";
      move(key, event.translationY);
    },
    // Failed or cancelled (the app left, a system gesture): the row goes back.
    onDeactivate: (event) => {
      "worklet";
      release(key, event.canceled);
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

/** An `onContentSizeChange` that records the content's height in `into`, then calls `then`. */
const recordHeight =
  (into: SharedValue<number>, then?: (width: number, height: number) => void) =>
  (width: number, height: number) => {
    into.set(height);
    then?.(width, height);
  };

/** A row's cell: records its layout, makes room for the lifted row (whose faded source moves to where
 * it lands), and gives an item its handle. FlatList's `CellRendererComponent`, or a nested row. */
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
  const places = drag?.places ?? NO_PLACES;
  // Layout counts rows unshifted: a transform never reaches onLayout, so hit-testing holds still.
  const shift = useSyncExternalStore(places.subscribe, () =>
    drag?.lifted ? shiftOf(index, places.get()) : 0
  );

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
      layout={drag.dropped ? undefined : drag.layout}
      style={[
        style,
        { transform: [{ translateY: shift }] },
        drag.moving && !drag.still ? MAKING_ROOM : null,
        key === drag.lifted ? { opacity: GHOST_OPACITY } : null,
      ]}
      onLayout={(event) => {
        recordInto(cells, key)(event);
        onLayout?.(event);
      }}
    >
      <CardContext value={recordCard}>
        <LiftedContext value={key === drag.lifted ? "ghost" : null}>
          {row.kind === "item" ? (
            <ItemHandle drag={drag} index={index} row={row}>
              {children}
            </ItemHandle>
          ) : (
            children
          )}
        </LiftedContext>
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
    <Animated.View className="absolute inset-x-0 top-0" pointerEvents="none" style={style}>
      <LiftedContext value="carried">{children}</LiftedContext>
    </Animated.View>
  );
}

/** The section the held row would land in, outlined around its rows as they make room. */
function SectionOutline({
  box,
  top,
  height,
}: {
  box: SharedValue<Box | null>;
  top: SharedValue<number>;
  height: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const at = box.get();

    return at
      ? {
          opacity: 1,
          left: at.x,
          width: at.width,
          height: height.get(),
          transform: [{ translateY: top.get() }],
        }
      : { opacity: 0 };
  });

  return (
    <Animated.View className="border-accent absolute top-0 rounded-3xl border-2" style={style} />
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
   * shown), or null where it changes nothing. The rows make room where the rule puts it. */
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

/** A list whose items a hold lifts and a drag carries: as web's sortable list, the rows make room
 * where it would land, its faded source sits there, and its section is outlined. */
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
  const heldRows = useHeldRows(rows, onDrop);
  const { shown } = heldRows;
  const outer = use(PageContext);
  const page = nested ? outer : null;
  const [lifted, setLifted] = useState<string | null>(null);
  const [places] = useState(placeStore);
  const [dropped, setDropped] = useState(false);
  const [moving, setMoving] = useState(false);
  const still = useReducedMotion();
  // The rows in the order a drag counts in, with each one's section, for the UI thread.
  const sections = sectionsOf(shown, sectionOf);
  const { listRef, layerRef, cells, cards, card, outline, contentHeight, start, move, release } =
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
          heldRows.lift();
          places.set(null);
          setLifted(key);
          setMoving(true);
          setDropped(false);
        },
        placed: places.set,
        // A kept drop renders the new order with every transform cleared in the same commit; a
        // refused one leaves the order, and the rows slide back.
        finished: (key, gap) => {
          const kept = heldRows.drop(key, gap);

          if (kept) mediumImpact();
          setLifted(null);
          setMoving(!kept);
          setDropped(kept);
        },
        rule: landAt
          ? (key, gap) => {
              const drop = heldRows.dropOf(key, gap);

              return drop && landAt(drop, heldRows.shown);
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

  // The drop's commit moved its rows without the layout animation; later changes animate again.
  useEffect(() => {
    if (dropped) setDropped(false);
  }, [dropped]);

  // A refused drop's rows slide back after the let-go, then stop carrying the transition.
  useEffect(() => {
    if (!moving || lifted) return;
    const timer = setTimeout(() => setMoving(false), SHIFT_MS);

    return () => clearTimeout(timer);
  }, [moving, lifted]);

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
    places,
    moving,
    dropped,
    still,
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
      <SectionOutline {...outline} />
      {liftedRow?.kind === "item" ? (
        <LiftedCard {...card}>{renderItem(liftedRow.value)}</LiftedCard>
      ) : null}
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
        // While rows move by transforms, iOS would scroll to keep its anchor row's moving frame still,
        // and Android would clip a row moved in from outside its laid-out bounds.
        maintainVisibleContentPosition={moving ? undefined : rest.maintainVisibleContentPosition}
        removeClippedSubviews={moving ? false : rest.removeClippedSubviews}
        renderItem={({ index }) => renderRow(shown[index]!, index)}
        renderScrollComponent={(props) => <OverlayScrollView {...props} overlay={overlay} />}
        onContentSizeChange={recordHeight(contentHeight, onContentSizeChange)}
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
        onContentSizeChange={recordHeight(contentHeight, onContentSizeChange)}
        onScroll={handler}
      >
        {children}
      </Animated.ScrollView>
    </PageContext>
  );
}
