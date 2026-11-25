import type { HouseholdUserInfo } from "@norish/shared/contracts/realtime/households";
import { invalidateHouseholdCacheForUsers } from "@norish/shared-server/cache/household";
import { emitConnectionInvalidation } from "@norish/shared-server/realtime/connection";
import { households } from "@norish/shared-server/realtime/households";

/**
 * Runs a committed membership change's announcements, then its Scope Change (ADR-0033)
 * even when an announcement throws, so the moved session never keeps its old household.
 */
export async function announceMembershipChange(
  change: { userId: string; reason: string; affectedUserIds: string[] },
  announce: () => Promise<void>
): Promise<void> {
  try {
    await announce();
  } finally {
    try {
      await invalidateHouseholdCacheForUsers([change.userId, ...change.affectedUserIds]);
    } finally {
      await emitConnectionInvalidation(change.userId, change.reason);
    }
  }
}

/** An account joined a household: its members hear who, then the joiner rescopes. */
export async function announceHouseholdJoin(
  join: {
    householdId: string;
    user: { id: string; name: string | null; version: number };
    memberIds: string[];
    reason: string;
  },
  announceFirst: () => Promise<void> = async () => undefined
): Promise<void> {
  const user: HouseholdUserInfo = { ...join.user, isAdmin: false };

  await announceMembershipChange(
    { userId: join.user.id, reason: join.reason, affectedUserIds: join.memberIds },
    async () => {
      await announceFirst();
      await households.publish("userJoined", { user }, { householdId: join.householdId });
    }
  );
}
