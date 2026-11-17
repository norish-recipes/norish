import { useEffect, useState } from "react";

/** A list row as the drag list holds it: a stable key and the value it draws. */
type Row = { key: string; value: object };

/** `keys` holds every row the list has shown since it loaded, null until it has. */
type Seen = {
  keys: ReadonlySet<string> | null;
  fresh: ReadonlySet<object>;
  epoch: unknown;
};

const NONE: ReadonlySet<object> = new Set();

/** The values of the rows the list shows for the first time, until the commit that mounts them is
 * done: none of the first load's, nor a row a filter, a fold, a scroll or a drop brings back. A
 * change of `epoch` (the range a list grew to) starts over with the rows then shown. */
export function useFreshRows(
  rows: readonly Row[],
  loaded: boolean,
  epoch?: unknown
): ReadonlySet<object> {
  const [seen, setSeen] = useState<Seen>({ keys: null, fresh: NONE, epoch });
  const added = seen.keys === null ? [] : rows.filter((row) => !seen.keys?.has(row.key));

  // Set while rendering, not in an effect: the commit that mounts a new row must already know it.
  if (loaded && (seen.keys === null || seen.epoch !== epoch)) {
    setSeen({ keys: new Set(rows.map((row) => row.key)), fresh: NONE, epoch });
  } else if (added.length > 0) {
    setSeen({
      keys: new Set([...(seen.keys ?? []), ...added.map((row) => row.key)]),
      fresh: new Set(added.map((row) => row.value)),
      epoch,
    });
  }

  useEffect(() => {
    if (seen.fresh.size > 0) setSeen((current) => ({ ...current, fresh: NONE }));
  }, [seen]);

  return seen.fresh;
}
