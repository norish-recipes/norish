/** The viewer and everyone in their household, once each: whose rows "household" covers. */
export function viewerAndHouseholdIds(viewer: {
  userId: string;
  householdUserIds: readonly string[] | null;
}): string[] {
  return [...new Set([viewer.userId, ...(viewer.householdUserIds ?? [])])];
}
