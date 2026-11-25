import type { HouseholdUserInfo } from "@norish/shared/contracts/realtime/households";
import { invalidateHouseholdCacheForUsers } from "@norish/shared-server/cache/household";
import { emitConnectionInvalidation } from "@norish/shared-server/realtime/connection";
import { households } from "@norish/shared-server/realtime/households";

/**
 * After a committed membership change: drops the household cache first, so no read
 * serves the old household, then announces, then the Scope Change (ADR-0033), which
 * runs even when the cache or an announcement throws.
 */
export async function announceMembershipChange(
  change: { userId: string; reason: string; affectedUserIds: string[] },
  announce: () => Promise<void>
): Promise<void> {
  try {
    await invalidateHouseholdCacheForUsers([change.userId, ...change.affectedUserIds]);
  } finally {
    try {
      await announce();
    } finally {
      await emitConnectionInvalidation(change.userId, change.reason);
    }
  }
}

/** An account joined a household: its members hear who, then the joiner rescopes. */
export async function announceHouseholdJoin(
  join: {
    householdId: string;
    user: { id: string; name: () => Promise<string | null>; version: number };
    memberIds: string[];
    reason: string;
  },
  announceFirst: () => Promise<void> = async () => undefined
): Promise<void> {
  await announceMembershipChange(
    { userId: join.user.id, reason: join.reason, affectedUserIds: join.memberIds },
    async () => {
      await announceFirst();

      const user: HouseholdUserInfo = {
        id: join.user.id,
        name: await join.user.name(),
        version: join.user.version,
        isAdmin: false,
      };

      await households.publish("userJoined", { user }, { householdId: join.householdId });
    }
  );
}
