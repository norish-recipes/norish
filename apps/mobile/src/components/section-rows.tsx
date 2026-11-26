import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";

/** A flat list's rows: a section's heading where it has one, then its items with their place in
 * the section's card. */
export type SectionRow<S, I> =
  | { type: "heading"; key: string; section: S; first: boolean }
  | { type: "item"; key: string; item: I; index: number; count: number };

/** The rows of a list's sections, `heading` saying which sections have a heading row. */
export function sectionRows<S, I>(
  sections: readonly { key: string; section: S; heading: boolean; items: readonly I[] }[],
  itemKey: (item: I) => string
): SectionRow<S, I>[] {
  const rows: SectionRow<S, I>[] = [];

  for (const { key, section, heading, items } of sections) {
    if (heading) {
      rows.push({ type: "heading", key: `heading-${key}`, section, first: rows.length === 0 });
    }
    items.forEach((item, index) =>
      rows.push({ type: "item", key: itemKey(item), item, index, count: items.length })
    );
  }

  return rows;
}

/** A heading row of a flat list: 16 pt above it, unless it opens the list, whose controls leave that room. */
export function HeadingRow({ first, children }: { first: boolean; children: ReactNode }) {
  return <View className={first ? "" : "pt-4"}>{children}</View>;
}
