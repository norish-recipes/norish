/** Replays a drop by id on the ids as they are now; `resolveDrop` moves by index in the rows shown. */
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
