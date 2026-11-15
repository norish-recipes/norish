import type { ReactNode, Ref } from "react";
import type { FlatList } from "react-native";
import type {
  ReorderableListProps,
  ReorderableListReorderEvent,
} from "react-native-reorderable-list";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import ReorderableList, {
  NestedReorderableList,
  ScrollViewContainer,
  useReorderableDrag,
} from "react-native-reorderable-list";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";

import type { DragRow, Drop } from "./resolve-drop";
import { useHeldRows } from "./use-held-rows";

export type { Drop, DragRow };

/** True inside the row a drag is carrying, for its lifted look. */
export { useIsActive as useIsLifted } from "react-native-reorderable-list";

/** The scroll view a `nested` list sits in, so a drag scrolls the page around it. */
export { ScrollViewContainer as DragScrollView };

type DragListProps<H, T> = Omit<
  ReorderableListProps<DragRow<H, T>>,
  | "data"
  | "renderItem"
  | "keyExtractor"
  | "onReorder"
  | "onDragStart"
  | "onDragEnd"
  | "animationDuration"
  | "cellAnimations"
> & {
  rows: DragRow<H, T>[];
  /** `index` counts in the rows shown, which a drag holds still. */
  renderHeading: (heading: H, index: number) => ReactNode;
  /** `drag` lifts the row; give it to the row's `onLongPress` so a tap still reaches `onPress`. */
  renderItem: (item: T, drag: () => void) => ReactNode;
  /**
   * Fired after a drop that moved the row, counted in the rows shown at the lift. The list shows
   * `drop.rows` until `rows` changes; returning false puts the row back instead.
   */
  onDrop: (drop: Drop<H, T>) => boolean | void;
  /** Laid out at full height inside a `DragScrollView`, which scrolls instead. */
  nested?: boolean;
  ref?: Ref<FlatList<DragRow<H, T>>>;
};

const mediumImpact = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// A module constant keeps the library from rebuilding its drag handlers each render.
const STILL_CELL = { opacity: 1, transform: [] };

/** How long a nested row is held before a pan drags it rather than the page. */
const HOLD_MS = 150;

function ItemRow<T>({
  item,
  render,
}: {
  item: T;
  render: (item: T, drag: () => void) => ReactNode;
}) {
  return render(item, useReorderableDrag());
}

export function DragList<H, T>({
  rows,
  renderHeading,
  renderItem,
  onDrop,
  nested = false,
  ...rest
}: DragListProps<H, T>) {
  const reduceMotion = useReducedMotion();
  const List = nested ? NestedReorderableList : ReorderableList;
  const held = useHeldRows(rows, onDrop);
  const latestRef = useRef(held);

  useEffect(() => {
    latestRef.current = held;
  });
  // Built once: the library rebuilds every row's drag handler when these change.
  const [events] = useState(() => {
    const lift = () => latestRef.current.lift();
    const settle = () => latestRef.current.settle();

    return {
      onDragStart: () => {
        "worklet";
        scheduleOnRN(mediumImpact);
        scheduleOnRN(lift);
      },
      onDragEnd: ({ from, to }: { from: number; to: number }) => {
        "worklet";
        scheduleOnRN(mediumImpact);
        // A move lands in onReorder once the row has settled.
        if (from === to) scheduleOnRN(settle);
      },
      onReorder: ({ from, to }: ReorderableListReorderEvent) => latestRef.current.drop(from, to),
    };
  });

  return (
    <List
      {...rest}
      animationDuration={reduceMotion ? 0 : 200}
      cellAnimations={reduceMotion ? STILL_CELL : undefined}
      data={held.shown}
      keyExtractor={(row) => row.key}
      // Nested, a swipe across a row scrolls the page; only a hold takes the row. Its successor,
      // `panGesture`, needs Gesture Handler 3's deprecated builder in a type the library lacks.
      // eslint-disable-next-line sonarjs/deprecation
      panActivateAfterLongPress={nested ? HOLD_MS : undefined}
      renderItem={({ item: row, index }) =>
        row.kind === "heading" ? (
          renderHeading(row.value, index)
        ) : (
          <ItemRow item={row.value} render={renderItem} />
        )
      }
      // A nested list never scrolls itself, which also keeps RN from flagging it as nested.
      scrollEnabled={nested ? false : rest.scrollEnabled}
      onDragEnd={events.onDragEnd}
      onDragStart={events.onDragStart}
      onReorder={events.onReorder}
    />
  );
}
