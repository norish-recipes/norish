import type { ReactNode, Ref, RefObject } from "react";
import type { FlatList } from "react-native";
import type { ReorderableListProps } from "react-native-reorderable-list";
import { useEffect } from "react";
import { useReducedMotion } from "react-native-reanimated";
import ReorderableList, {
  NestedReorderableList,
  ScrollViewContainer,
  useReorderableDrag,
} from "react-native-reorderable-list";

import type { DragRow, Drop } from "./resolve-drop";
import { useDragEvents } from "./use-drag-events";
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
  /** Told when a row is lifted and when it is let go. */
  onHeldChange?: (held: boolean) => void;
  /** Laid out at full height inside a `DragScrollView`, which scrolls instead. */
  nested?: boolean;
  ref?: Ref<FlatList<DragRow<H, T>>>;
  /** Holds the rows shown, which a scroll by index counts in. */
  shownRef?: RefObject<DragRow<H, T>[]>;
};

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
  onHeldChange,
  nested = false,
  shownRef,
  ...rest
}: DragListProps<H, T>) {
  const reduceMotion = useReducedMotion();
  const List = nested ? NestedReorderableList : ReorderableList;
  const held = useHeldRows(rows, onDrop);
  const events = useDragEvents(held, onHeldChange);

  useEffect(() => {
    if (shownRef) shownRef.current = held.shown;
  });

  return (
    <List
      {...rest}
      animationDuration={reduceMotion ? 0 : 200}
      cellAnimations={reduceMotion ? STILL_CELL : undefined}
      data={held.shown}
      keyExtractor={(row) => row.key}
      // Nested, a swipe across a row scrolls the page; only a hold takes the row.
      // eslint-disable-next-line sonarjs/deprecation -- its successor `panGesture` needs a builder type the library lacks
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
