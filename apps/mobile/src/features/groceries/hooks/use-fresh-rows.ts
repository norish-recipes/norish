import { useEffect, useState } from "react";

import type { ListRow } from "../utils/list-rows";

type Seen = { keys: ReadonlySet<string>; fresh: ReadonlySet<object> };

const NONE: ReadonlySet<object> = new Set();

/** The values of the rows that are new to the list, until the commit that mounts them is done:
 * not those of the first load, nor the ones a scroll or a drop mounts again. */
export function useFreshRows(rows: readonly ListRow[]): ReadonlySet<object> {
  const [seen, setSeen] = useState<Seen>(() => ({ keys: new Set(), fresh: NONE }));
  const added = rows.filter((row) => !seen.keys.has(row.key));

  if (added.length > 0) {
    setSeen({
      keys: new Set(rows.map((row) => row.key)),
      fresh: seen.keys.size === 0 ? NONE : new Set(added.map((row) => row.value)),
    });
  }

  useEffect(() => {
    if (seen.fresh.size > 0) setSeen((current) => ({ ...current, fresh: NONE }));
  }, [seen]);

  return seen.fresh;
}
