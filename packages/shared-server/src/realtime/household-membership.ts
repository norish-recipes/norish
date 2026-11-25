import type { HouseholdUserInfo } from "@norish/shared/contracts/realtime/households";
import { invalidateHouseholdCacheForUsers } from "@norish/shared-server/cache/household";
import { emitConnectionInvalidation } from "@norish/shared-server/realtime/connection";
import { households } from "@norish/shared-server/realtime/households";

/** Who hears a committed membership change: the account that moved, then those who stay. */
export interface MembershipAnnouncements {
  toMover?: () => Promise<void>;
  toOthers?: () => Promise<void>;
}

/**
 * Drops the household cache, tells the mover, then its Scope Change (ADR-0033) without waiting on
 * those who stay, who hear last. Each step runs even when an earlier one throws.
 */
export async function announceMembershipChange(
  change: { userId: string; reason: string; affectedUserIds: string[] },
  announce: MembershipAnnouncements
): Promise<void> {
  try {
    await invalidateHouseholdCacheForUsers([change.userId, ...change.affectedUserIds]);
  } finally {
    try {
      await announce.toMover?.();
    } finally {
      try {
        await emitConnectionInvalidation(change.userId, change.reason);
      } finally {
        await announce.toOthers?.();
      }
    }
  }
}

/** An account joined a household: the joiner rescopes, then its members hear who. */
export async function announceHouseholdJoin(
  join: {
    householdId: string;
    user: { id: string; name: () => Promise<string | null>; version: number };
    memberIds: string[];
    reason: string;
  },
  toJoiner?: () => Promise<void>
): Promise<void> {
  await announceMembershipChange(
    { userId: join.user.id, reason: join.reason, affectedUserIds: join.memberIds },
    {
      toMover: toJoiner,
      toOthers: async () => {
        const user: HouseholdUserInfo = {
          id: join.user.id,
          name: await join.user.name(),
          version: join.user.version,
          isAdmin: false,
        };

        await households.publish("userJoined", { user }, { householdId: join.householdId });
      },
    }
  );
}
