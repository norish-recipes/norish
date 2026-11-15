import { useEffect, useState } from "react";

import type { DragRow, Drop } from "./resolve-drop";
import { resolveDrop } from "./resolve-drop";

type Held<H, T> = {
  /** What the list shows: the rows a row was lifted from, or where a drop put it. */
  shown: DragRow<H, T>[];
  /** The `rows` this was held over: once they change, the list shows them again. */
  over: DragRow<H, T>[];
  dragging: boolean;
  /** A refused drop, shown for one commit so the list moves the row back as a reorder. */
  refused?: boolean;
};

/**
 * The rows a drag list shows. Under a lifted row they hold still, so a realtime change can't
 * move the slots the drag counts in; after a kept drop they show it until `rows` changes.
 */
export function useHeldRows<H, T>(
  rows: DragRow<H, T>[],
  onDrop: (drop: Drop<H, T>) => boolean | void
) {
  const [held, setHeld] = useState<Held<H, T> | null>(null);
  const current = held && (held.dragging || held.over === rows) ? held : null;

  if (held && !current) setHeld(null);
  const shown = current?.shown ?? rows;

  // The list has already moved the row; only rows in a new order move it back.
  useEffect(() => {
    if (held?.refused) setHeld(null);
  }, [held]);

  return {
    shown,
    lift: () => setHeld({ shown, over: rows, dragging: true }),
    /** `from` and `to` count in the rows shown at the lift; `onDrop` returning false puts it back. */
    drop: (from: number, to: number) => {
      const drop = resolveDrop(shown, from, to);

      if (!drop) return setHeld(null);
      const kept = onDrop(drop) !== false;

      setHeld({ shown: drop.rows, over: rows, dragging: false, refused: !kept });
    },
    /** A drag that ended where it began. */
    settle: () => setHeld(null),
  };
}
