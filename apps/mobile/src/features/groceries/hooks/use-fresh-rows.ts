import { useEffect, useState } from "react";

import type { ListRow } from "../utils/list-rows";

/** `keys` holds every row the list has shown since it loaded, null until it has. */
type Seen = { keys: ReadonlySet<string> | null; fresh: ReadonlySet<object> };

const NONE: ReadonlySet<object> = new Set();

/** The values of the rows the list shows for the first time, until the commit that mounts them is
 * done: none of the first load's, nor a row a filter, a fold, a scroll or a drop brings back. */
export function useFreshRows(rows: readonly ListRow[], loaded: boolean): ReadonlySet<object> {
  const [seen, setSeen] = useState<Seen>({ keys: null, fresh: NONE });
  const added = seen.keys === null ? [] : rows.filter((row) => !seen.keys?.has(row.key));

  // Set while rendering, not in an effect: the commit that mounts a new row must already know it.
  if (loaded && seen.keys === null) {
    setSeen({ keys: new Set(rows.map((row) => row.key)), fresh: NONE });
  } else if (added.length > 0) {
    setSeen({
      keys: new Set([...(seen.keys ?? []), ...added.map((row) => row.key)]),
      fresh: new Set(added.map((row) => row.value)),
    });
  }

  useEffect(() => {
    if (seen.fresh.size > 0) setSeen((current) => ({ ...current, fresh: NONE }));
  }, [seen]);

  return seen.fresh;
}
