import { useEffect, useRef, useState } from "react";

type Line = { id: string };

/**
 * Which of a recipe's lines are ticked in the groceries panel. The ticks start from what is to buy
 * once the Pantry has answered, and a line takes its section's default whenever it joins a section.
 */
export function useLineSelection<T extends Line>({
  lines,
  toBuy,
  inPantry,
  pantryLoading,
  pantryUnavailable,
}: {
  lines: T[];
  toBuy: T[];
  inPantry: T[];
  pantryLoading: boolean;
  pantryUnavailable: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const hasInitializedRef = useRef(false);
  const knownIngredientIdsRef = useRef<Set<string>>(new Set());
  // Which lines the Pantry held when the ticks were last settled, so a line
  // that crosses between the sections can be told from one that has not.
  const knownInPantryIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Nothing is pre-ticked until the Pantry answers, so a line in it is never ticked; an
    // unreadable Pantry ticks nothing either, and the person is told why.
    if (pantryLoading || pantryUnavailable) return;
    const currentIds = lines.map((i) => i.id).filter(Boolean);
    const toBuyIds = new Set(toBuy.map((item) => item.id));
    const inPantryIds = new Set(inPantry.map((item) => item.id));

    if (currentIds.length > 0 && !hasInitializedRef.current) {
      knownIngredientIdsRef.current = new Set(currentIds);
      knownInPantryIdsRef.current = inPantryIds;
      setSelectedIds(currentIds.filter((id) => toBuyIds.has(id)));
      hasInitializedRef.current = true;

      return;
    }

    // A line joining a section takes its default; a tick doesn't travel with it, or a line the
    // Pantry just claimed would stay ticked to buy.
    const isNew = (id: string) => !knownIngredientIdsRef.current.has(id);
    const wasInPantry = (id: string) => knownInPantryIdsRef.current.has(id);
    const tick = currentIds.filter((id) => toBuyIds.has(id) && (isNew(id) || wasInPantry(id)));
    const untick = currentIds.filter((id) => inPantryIds.has(id) && !isNew(id) && !wasInPantry(id));

    knownIngredientIdsRef.current = new Set(currentIds);
    knownInPantryIdsRef.current = inPantryIds;

    if (tick.length === 0 && untick.length === 0) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);

      for (const id of tick) next.add(id);
      for (const id of untick) next.delete(id);

      return Array.from(next);
    });
  }, [lines, toBuy, inPantry, pantryLoading, pantryUnavailable]);

  // Counted over visible rows, so a vanished line's id can't make the list look all selected;
  // the count and select-all cover what is to buy, not the Pantry's lines.
  const selectedCount = toBuy.filter((item) => selectedIds.includes(item.id)).length;
  const inPantrySelectedCount = inPantry.filter((item) => selectedIds.includes(item.id)).length;

  return {
    selectedIds,
    selectedCount,
    inPantrySelectedCount,
    isSelected: (id: string) => selectedIds.includes(id),
    toggleSelect: (id: string) =>
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    /**
     * One section's select-all: every line ticked, or none once every line already is. Each
     * section answers for its own lines and leaves the other section's ticks exactly as they were.
     */
    toggleSection: (section: Line[], other: Line[]) => {
      const allOfSectionSelected = section.every((item) => selectedIds.includes(item.id));
      const otherSelected = other.map((item) => item.id).filter((id) => selectedIds.includes(id));

      setSelectedIds(
        allOfSectionSelected ? otherSelected : [...otherSelected, ...section.map((item) => item.id)]
      );
    },
  };
}
