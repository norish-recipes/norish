/**
 * The ids in the order the list holds them now, with `movedId` placed after `aboveId` (first when
 * there is none). Resolved by id, so a row a housemate added or removed during the drag is kept
 * or dropped as the list has it.
 */
export function movedAfter(
  currentIds: readonly string[],
  movedId: string,
  aboveId: string | null
): string[] {
  if (!currentIds.includes(movedId)) return [...currentIds];

  const rest = currentIds.filter((id) => id !== movedId);
  const at = aboveId === null ? -1 : rest.indexOf(aboveId);

  return [...rest.slice(0, at + 1), movedId, ...rest.slice(at + 1)];
}
