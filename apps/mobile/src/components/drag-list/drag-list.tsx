import type { ReactNode } from "react";
import type {
  ReorderableListProps,
  ReorderableListReorderEvent,
} from "react-native-reorderable-list";
import { useReducedMotion } from "react-native-reanimated";
import ReorderableList, { useReorderableDrag } from "react-native-reorderable-list";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";

import type { DragRow, Drop } from "./resolve-drop";
import { resolveDrop } from "./resolve-drop";

export type { Drop, DragRow };

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
  renderHeading: (heading: H) => ReactNode;
  /** `drag` lifts the row; give it to the row's `onLongPress` so a tap still reaches `onPress`. */
  renderItem: (item: T, drag: () => void) => ReactNode;
  /** Fired after a drop that moved the row; the list is controlled, so apply `drop.rows`. */
  onDrop: (drop: Drop<H, T>) => void;
};

const mediumImpact = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

const dragHaptic = () => {
  "worklet";
  scheduleOnRN(mediumImpact);
};

// A module constant keeps the library from rebuilding its drag handlers each render.
const STILL_CELL = { opacity: 1, transform: [] };

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
  ...rest
}: DragListProps<H, T>) {
  const reduceMotion = useReducedMotion();

  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const drop = resolveDrop(rows, from, to);

    if (drop) onDrop(drop);
  };

  return (
    <ReorderableList
      {...rest}
      animationDuration={reduceMotion ? 0 : 200}
      cellAnimations={reduceMotion ? STILL_CELL : undefined}
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={({ item: row }) =>
        row.kind === "heading" ? (
          renderHeading(row.value)
        ) : (
          <ItemRow item={row.value} render={renderItem} />
        )
      }
      onDragEnd={dragHaptic}
      onDragStart={dragHaptic}
      onReorder={onReorder}
    />
  );
}
