"use client";

import { useState } from "react";

import type { IngredientItem } from "@norish/shared-react/ingredients";
import { useIngredientKinds } from "@norish/shared-react/ingredients";

/** One line of the page's tree: a food, how deep it sits, and whether its kinds are folded out. */
export interface IngredientTreeRow {
  item: IngredientItem;
  depth: number;
  expanded: boolean;
  /** Its kinds are being fetched. */
  loading: boolean;
}

/**
 * The catalogue as a tree of kinds: the roots the list was given, and under
 * each one the viewer folded out, its kinds, fetched as they are opened and
 * folded out as deep as the viewer goes. "chocolate" opens to "white
 * chocolate", which opens to "Belgian white chocolate". Off (`enabled`
 * false) the rows are the list as given, flat: a search finds a food at any
 * depth, so it is not shown as a tree.
 */
export function useIngredientTree(
  roots: IngredientItem[],
  enabled: boolean,
  locale: string
): {
  rows: IngredientTreeRow[];
  toggle: (id: string) => void;
} {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const open = enabled ? [...expanded] : [];
  const kinds = useIngredientKinds(open, locale);
  const children = new Map(open.map((id, index) => [id, kinds[index]]));

  const rows: IngredientTreeRow[] = [];

  if (!enabled) {
    for (const item of roots) rows.push({ item, depth: 0, expanded: false, loading: false });
  } else {
    // Each food once: a page of roots not yet refetched may still list a
    // food its new parent's kinds already fold out, and two rows with one
    // key leave React's list in a state it never recovers from.
    const listed = new Set<string>();
    const walk = (items: IngredientItem[], depth: number) => {
      for (const item of items) {
        if (listed.has(item.id)) continue;
        listed.add(item.id);
        const fetched = children.get(item.id);
        const isOpen = expanded.has(item.id) && item.kinds > 0;

        rows.push({
          item,
          depth,
          expanded: isOpen,
          loading: isOpen && (fetched?.loading ?? false),
        });
        if (isOpen && fetched?.items) walk(fetched.items, depth + 1);
      }
    };

    walk(roots, 0);
  }

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  };

  return { rows, toggle };
}
