import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";
import {
  getAllergiesForUsers,
  getHouseholdForUser,
  isUserHouseholdAdmin,
  joinHousehold,
  kickUserFromHousehold,
  moveToHouseholdOfOne,
  regenerateJoinCode,
  transferHouseholdAdmin,
} from "@norish/db";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  announceHouseholdJoin,
  announceMembershipChange,
} from "@norish/shared-server/realtime/household-membership";
import { households } from "@norish/shared-server/realtime/households";
import {
  KickHouseholdUserInputSchema,
  LeaveHouseholdInputSchema,
  RegenerateHouseholdJoinCodeInputSchema,
  TransferHouseholdAdminInputSchema,
} from "@norish/shared/contracts/zod";
import { JoinCodeSchema } from "@norish/shared/lib/validation/schemas";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * Transforms household data to DTO based on admin status
 */
function toHouseholdDto(
  household: Awaited<ReturnType<typeof getHouseholdForUser>>,
  userId: string,
  allergies: string[]
): HouseholdSettingsDto | HouseholdAdminSettingsDto | null {
  if (!household) return null;

  const typedHousehold = household as typeof household & {
    version: number;
    users: Array<{ id: string; name: string | null; isAdmin?: boolean; version: number }>;
  };

  const isAdmin = typedHousehold.adminUserId === userId;
  const now = new Date();
  const isJoinCodeExpired =
    !typedHousehold.joinCodeExpiresAt || new Date(typedHousehold.joinCodeExpiresAt) < now;
  const typedUsers = typedHousehold.users as Array<{
    id: string;
    name: string | null;
    isAdmin?: boolean;
    version: number;
  }>;

  const users = typedUsers.map((u) => ({
    id: u.id,
    name: u.name ?? null,
    isAdmin: u.isAdmin ?? u.id === typedHousehold.adminUserId,
    version: u.version,
  }));

  if (isAdmin) {
    return {
      id: typedHousehold.id,
      name: typedHousehold.name,
      version: typedHousehold.version,
      joinCode: isJoinCodeExpired ? null : typedHousehold.joinCode,
      joinCodeExpiresAt: isJoinCodeExpired ? null : typedHousehold.joinCodeExpiresAt,
      users,
      allergies,
    } as HouseholdAdminSettingsDto;
  }

  return {
    id: typedHousehold.id,
    name: typedHousehold.name,
    version: typedHousehold.version,
    users,
    allergies,
  } as HouseholdSettingsDto;
}

/** The household as `userId` sees it in settings, allergies included. */
async function householdSettingsFor(userId: string) {
  const household = await getHouseholdForUser(userId);
  const userIds = household?.users.map((u) => u.id) ?? [];
  const allergiesRows = await getAllergiesForUsers(userIds);
  const allergies = [...new Set(allergiesRows.map((a) => a.tagName))];

  return toHouseholdDto(household, userId, allergies);
}

/** Sends `userId` their household as settings show it, ahead of their Scope Change. */
async function publishHouseholdTo(userId: string): Promise<void> {
  const dto = await householdSettingsFor(userId);

  if (dto) await households.publish("created", { household: dto }, { userId });
}

const get = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting household settings");

  const household = await householdSettingsFor(ctx.user.id);

  // Every account has a household; none means the account is gone.
  if (!household) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Household not found" });
  }

  return { household, currentUserId: ctx.user.id };
});

const JOIN_REFUSALS = {
  "already-member": "You are already in this household.",
  shared: "You are already in a household. Leave it first to join another one.",
  "holds-things":
    "Your household already has recipes, groceries or plans of its own, so it cannot join another household yet.",
  gone: "Invalid join code",
  expired: "This join code has expired",
} as const;

const join = authedProcedure
  .input(z.object({ code: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Clean the code - only digits, max 6
    const cleaned = input.code.replace(/\D/g, "").slice(0, 6);

    log.info({ userId: ctx.user.id }, "Joining household by code");

    // Validate cleaned code format
    JoinCodeSchema.parse(cleaned);

    // The code is checked under the household's lock, in the move's own transaction.
    const outcome = await joinHousehold(ctx.user.id, { joinCode: cleaned });

    if ("refused" in outcome) {
      const badCode = outcome.refused === "gone" || outcome.refused === "expired";

      throw new TRPCError({
        code: badCode ? "BAD_REQUEST" : "CONFLICT",
        message: JOIN_REFUSALS[outcome.refused],
      });
    }

    const { householdId } = outcome.joined;

    log.info({ userId: ctx.user.id, householdId }, "User joined household");

    void announceHouseholdJoin(
      {
        householdId,
        user: {
          id: ctx.user.id,
          name: async () => ctx.user.name ?? null,
          version: outcome.joined.version,
        },
        memberIds: outcome.memberIds,
        reason: "household-joined",
      },
      // The joiner's view receives the household before its socket closes.
      () => publishHouseholdTo(ctx.user.id)
    ).catch((err) => {
      log.error({ err, userId: ctx.user.id }, "Failed to announce household join");
    });

    return { householdId };
  });

const leave = authedProcedure.input(LeaveHouseholdInputSchema).mutation(async ({ ctx, input }) => {
  const { householdId, version } = input;

  log.info({ userId: ctx.user.id, householdId }, "Leaving household");

  const household = await getHouseholdForUser(ctx.user.id);

  if (!household || household.id !== householdId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not in this household",
    });
  }

  if (household.users.length === 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You are the only member of this household.",
    });
  }

  // Check if user is admin with other members
  if (household.adminUserId === ctx.user.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "You must transfer admin privileges before leaving. Go to Household Settings to assign a new admin.",
    });
  }

  // Remove user async and emit events - fire and forget
  moveToHouseholdOfOne(householdId, ctx.user.id, version)
    .then(async (result) => {
      if (result.stale) {
        log.info(
          { userId: ctx.user.id, householdId, version },
          "Ignoring stale household leave mutation"
        );

        return;
      }

      log.info({ userId: ctx.user.id, householdId }, "User left household");

      const { memberIds } = result.value;

      await announceMembershipChange(
        { userId: ctx.user.id, reason: "household-left", affectedUserIds: memberIds },
        async () => {
          // Remaining members hear it before the leaver's socket restarts.
          for (const memberId of memberIds) {
            await households.publish("userLeft", { userId: ctx.user.id }, { userId: memberId });
          }

          await publishHouseholdTo(ctx.user.id);
        }
      );
    })
    .catch((err) => {
      log.error({ err, userId: ctx.user.id }, "Failed to leave household");
      void households.publish(
        "failed",
        {
          reason: "Failed to leave household",
        },
        { userId: ctx.user.id }
      );
    });

  return { success: true };
});

const kick = authedProcedure
  .input(KickHouseholdUserInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { householdId, userId: userIdToKick, version } = input;

    log.info({ userId: ctx.user.id, householdId, userIdToKick }, "Kicking user from household");

    // Verify admin status
    const isAdmin = await isUserHouseholdAdmin(householdId, ctx.user.id);

    if (!isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the household admin can kick members",
      });
    }

    if (userIdToKick === ctx.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You cannot kick yourself",
      });
    }

    // Verify the user is actually in the household
    const household = await getHouseholdForUser(ctx.user.id);
    const kickedUser = household?.users.find((u) => u.id === userIdToKick);

    if (!kickedUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User is not a member of this household",
      });
    }

    // Kick user async and emit events
    kickUserFromHousehold(householdId, userIdToKick, ctx.user.id, version)
      .then(async (result) => {
        if (result.stale) {
          log.info(
            { userId: ctx.user.id, householdId, userIdToKick, version },
            "Ignoring stale household kick mutation"
          );

          return;
        }

        log.info({ userId: ctx.user.id, householdId, userIdToKick }, "User kicked from household");

        await announceMembershipChange(
          {
            userId: userIdToKick,
            reason: "household-kicked",
            affectedUserIds: result.value.memberIds,
          },
          async () => {
            // The kicked user gets their new household of one and hears why before the
            // socket closes; the reconnect refetches under the new identity (ADR-0011).
            await publishHouseholdTo(userIdToKick);
            await households.publish(
              "userKicked",
              { householdId, kickedBy: ctx.user.id },
              { userId: userIdToKick }
            );
            await households.publish("memberRemoved", { userId: userIdToKick }, { householdId });
          }
        );
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Failed to kick user");
        void households.publish(
          "failed",
          {
            reason: "Failed to kick user from household",
          },
          { userId: ctx.user.id }
        );
      });

    return { success: true };
  });

const regenerateCode = authedProcedure
  .input(RegenerateHouseholdJoinCodeInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { householdId, version } = input;

    log.info({ userId: ctx.user.id, householdId }, "Regenerating join code");

    // Verify admin status
    const isAdmin = await isUserHouseholdAdmin(householdId, ctx.user.id);

    if (!isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the household admin can regenerate the join code",
      });
    }

    // Regenerate code async and emit events
    regenerateJoinCode(householdId, version)
      .then((result) => {
        if (result.stale || !result.value) {
          log.info(
            { userId: ctx.user.id, householdId, version },
            "Ignoring stale household join-code regeneration"
          );

          return;
        }

        const household = result.value;

        log.info({ userId: ctx.user.id, householdId }, "Join code regenerated");

        // Emit to all household members
        void households.publish(
          "joinCodeRegenerated",
          {
            joinCode: household.joinCode!,
            joinCodeExpiresAt: household.joinCodeExpiresAt!.toISOString(),
            version: household.version,
          },
          { householdId }
        );
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Failed to regenerate join code");
        void households.publish(
          "failed",
          {
            reason: "Failed to regenerate join code",
          },
          { userId: ctx.user.id }
        );
      });

    return { success: true };
  });

const transferAdmin = authedProcedure
  .input(TransferHouseholdAdminInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { householdId, newAdminId, version } = input;

    log.info({ userId: ctx.user.id, householdId, newAdminId }, "Transferring admin");

    // Verify current admin status
    const isAdmin = await isUserHouseholdAdmin(householdId, ctx.user.id);

    if (!isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the current admin can transfer admin privileges",
      });
    }

    if (newAdminId === ctx.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You are already the admin",
      });
    }

    // Transfer admin async and emit events
    transferHouseholdAdmin(householdId, ctx.user.id, newAdminId, version)
      .then((result) => {
        if (result.stale || !result.value) {
          log.info(
            { userId: ctx.user.id, householdId, newAdminId, version },
            "Ignoring stale household admin transfer"
          );

          return;
        }

        const household = result.value;

        log.info({ userId: ctx.user.id, householdId, newAdminId }, "Admin transferred");

        // Emit to all household members
        void households.publish(
          "adminTransferred",
          {
            oldAdminId: ctx.user.id,
            newAdminId,
            version: household.version,
          },
          { householdId }
        );
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Failed to transfer admin");
        void households.publish(
          "failed",
          {
            reason: "Failed to transfer admin privileges",
          },
          { userId: ctx.user.id }
        );
      });

    return { success: true };
  });

export const householdsRouter = router({
  get,
  join,
  leave,
  kick,
  regenerateCode,
  transferAdmin,
});
