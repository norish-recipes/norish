import type { ComponentRef } from "react";
import type { TextInput } from "react-native";
import { useRef, useState } from "react";

import { rowsAfterLeaving } from "@norish/shared-react/recipes";

/**
 * The editor's rows with the trailing empty one to type into hidden until Add asks for it (a
 * recipe with no rows yet shows it). Return moves focus down; an emptied row goes when left.
 */
export function useTrailingRow<T extends { id: string }>(
  rows: T[],
  hasContent: (row: T) => boolean
) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const inputsRef = useRef(new Map<string, ComponentRef<typeof TextInput>>());
  const emptyRow = rows.at(-1);
  const visibleRows = rows.filter(
    (row) =>
      row !== emptyRow ||
      rows.length === 1 ||
      row.id === focusedId ||
      row.id === revealedId ||
      hasContent(row)
  );
  const focusAfter = (index: number) => {
    const next = rows[index + 1];

    if (!next) return;
    if (next === emptyRow) setRevealedId(next.id);
    inputsRef.current.get(next.id)?.focus();
  };

  return {
    focusedId,
    visibleRows,
    /** Add shows while the empty row is hidden. */
    canAdd: visibleRows.length < rows.length,
    add: () => setRevealedId(emptyRow?.id ?? null),
    /** What the row's field needs: its ref, focus, and Return moving down. */
    inputProps: (row: T, index: number) => ({
      ref: (input: ComponentRef<typeof TextInput> | null) => {
        if (input) inputsRef.current.set(row.id, input);
        else inputsRef.current.delete(row.id);
      },
      autoFocus: row.id === revealedId,
      onFocus: () => setFocusedId(row.id),
      onSubmitEditing: () => focusAfter(index),
    }),
    /** Unfocuses the row; the rows without it when it was emptied, else null. */
    leave: (index: number): T[] | null => {
      setFocusedId(null);
      const next = rowsAfterLeaving(rows, index, hasContent);

      return next === rows ? null : next;
    },
  };
}
