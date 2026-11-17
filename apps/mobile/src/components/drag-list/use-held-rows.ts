import { useState } from "react";

import type { DragRow, Drop } from "./resolve-drop";
import { dropAt } from "./drop-target";

type Held<H, T> = {
  /** What the list shows: the rows a row was lifted from, or where a drop put it. */
  shown: DragRow<H, T>[];
  /** The `rows` this was held over: once they change, the list shows them again. */
  over: DragRow<H, T>[];
  dragging: boolean;
};

/** The rows a drag list shows. Under a lifted row they hold still, so a realtime change can't
 * move the slots the drag counts in; after a kept drop they show it until `rows` changes. */
export function useHeldRows<H, T>(
  rows: DragRow<H, T>[],
  onDrop: (drop: Drop<H, T>) => boolean | void
) {
  const [held, setHeld] = useState<Held<H, T> | null>(null);
  const current = held && (held.dragging || held.over === rows) ? held : null;

  if (held && !current) setHeld(null);
  const shown = current?.shown ?? rows;

  return {
    shown,
    lift: () => setHeld({ shown, over: rows, dragging: true }),
    /** The row at `from` let go into `gap`, both counted in the rows shown at the lift; `onDrop`
     * returning false puts it back. True when the drop was kept. */
    drop: (from: number, gap: number | null) => {
      const drop = gap === null ? null : dropAt(shown, from, gap);
      const kept = drop !== null && onDrop(drop) !== false;

      setHeld(kept ? { shown: drop.rows, over: rows, dragging: false } : null);

      return kept;
    },
  };
}
