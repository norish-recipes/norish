import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { MutationAckWith } from "@norish/shared/contracts";
import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";
import {
  addUserToHousehold,
  createHousehold,
  findHouseholdByJoinCode,
  getAllergiesForUsers,
  getHouseholdForUser,
  getUsersByHouseholdId,
  isUserHouseholdAdmin,
  kickUserFromHousehold,
  regenerateJoinCode,
  removeUserFromHousehold,
  transferHouseholdAdmin,
} from "@norish/db";
import {
  invalidateHouseholdCache,
  invalidateHouseholdCacheForUsers,
} from "@norish/shared-server/cache/household";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { appliedAck, mutationAckSchema, staleAck } from "@norish/shared/contracts";
import {
  KickHouseholdUserInputSchema,
  LeaveHouseholdInputSchema,
  RegenerateHouseholdJoinCodeInputSchema,
  TransferHouseholdAdminInputSchema,
} from "@norish/shared/contracts/zod";
import { HouseholdNameSchema, JoinCodeSchema } from "@norish/shared/lib/validation/schemas";

import type { HouseholdUserInfo } from "./types";
import { emitConnectionInvalidation } from "../../connection-manager";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { permissionsEmitter } from "../permissions/emitter";
import { householdEmitter } from "./emitter";

export type HouseholdCreateMutationOutput = MutationAckWith<{ id: string }>;
export type HouseholdJoinMutationOutput = MutationAckWith<{ householdId: string }>;

const householdCreateAckSchema: z.ZodType<HouseholdCreateMutationOutput> = mutationAckSchema.extend(
  {
    id: z.string().uuid(),
  }
);
const householdJoinAckSchema: z.ZodType<HouseholdJoinMutationOutput> = mutationAckSchema.extend({
  householdId: z.string().uuid(),
});

/**
 * Connection invalidation must happen after the response: terminating this
 * WebSocket first can prevent the mutation acknowledgement from reaching its caller.
 */
function deferConnectionInvalidation(userId: string, reason: string): void {
  setTimeout(() => {
    void invalidateConnectionAfterResponse(userId, reason);
  }, 0);
}

async function invalidateConnectionAfterResponse(userId: string, reason: string): Promise<void> {
  try {
    await emitConnectionInvalidation(userId, reason);
  } catch (err) {
    log.error({ err, userId, reason }, "Failed to invalidate household connection");
  }
}

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

const get = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting household settings");

  const household = await getHouseholdForUser(ctx.user.id);
  const userIds = household?.users.map((u) => u.id) ?? [];
  const allergiesRows = await getAllergiesForUsers(userIds);
  const allergies = [...new Set(allergiesRows.map((a) => a.tagName))];
  const dto = toHouseholdDto(household, ctx.user.id, allergies);

  log.debug({ userId: ctx.user.id, hasHousehold: !!dto }, "Household settings retrieved");

  return { household: dto, currentUserId: ctx.user.id };
});

const create = authedProcedure
  .input(z.object({ name: HouseholdNameSchema }))
  .output(householdCreateAckSchema)
  .mutation(async ({ ctx, input }) => {
    const name = (input.name ?? "My Household").trim();

    log.info({ userId: ctx.user.id, name }, "Creating household");

    // Check if user is already in a household
    const existingHousehold = await getHouseholdForUser(ctx.user.id);

    if (existingHousehold) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You are already in a household. Leave it first to create a new one.",
      });
    }

    try {
      const household = await createHousehold({ name, adminUserId: ctx.user.id });

      await addUserToHousehold({ householdId: household.id, userId: ctx.user.id });

      // Auto-generate join code for new household
      await regenerateJoinCode(household.id);

      log.info({ userId: ctx.user.id, householdId: household.id }, "Household created");

      const fullHousehold = await getHouseholdForUser(ctx.user.id);
      const userIds = fullHousehold?.users.map((u) => u.id) ?? [];
      const allergiesRows = await getAllergiesForUsers(userIds);
      const allergies = [...new Set(allergiesRows.map((a) => a.tagName))];
      const dto = toHouseholdDto(fullHousehold, ctx.user.id, allergies);

      // This must happen before connection invalidation so the client receives it.
      await householdEmitter.emitToUser(ctx.user.id, "created", { household: dto! });

      await invalidateHouseholdCache(ctx.user.id);
      deferConnectionInvalidation(ctx.user.id, "household-created");

      return appliedAck({ id: household.id });
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to create household");
      throw err;
    }
  });

const join = authedProcedure
  .input(z.object({ code: z.string() }))
  .output(householdJoinAckSchema)
  .mutation(async ({ ctx, input }) => {
    // Clean the code - only digits, max 6
    const cleaned = input.code.replace(/\D/g, "").slice(0, 6);

    log.info({ userId: ctx.user.id }, "Joining household by code");

    // Validate cleaned code format
    JoinCodeSchema.parse(cleaned);

    // Check if user is already in a household
    const existingHousehold = await getHouseholdForUser(ctx.user.id);

    if (existingHousehold) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You are already in a household. Leave it first to join another one.",
      });
    }

    // Find household by code
    const household = await findHouseholdByJoinCode(cleaned);

    if (!household) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid join code",
      });
    }

    // Check if code is expired
    if (household.joinCodeExpiresAt && new Date(household.joinCodeExpiresAt) < new Date()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This join code has expired",
      });
    }

    const householdId = household.id;

    // Fetch existing member IDs for cache invalidation
    const existingMembers = await getUsersByHouseholdId(householdId);
    const existingMemberIds = existingMembers.map((u) => u.userId);

    try {
      const membership = await addUserToHousehold({ householdId, userId: ctx.user.id });

      log.info({ userId: ctx.user.id, householdId }, "User joined household");
      const versionedMembership = membership as typeof membership & { version: number };

      const fullHousehold = await getHouseholdForUser(ctx.user.id);
      const userIds = fullHousehold?.users.map((u) => u.id) ?? [];
      const allergiesRows = await getAllergiesForUsers(userIds);
      const allergies = [...new Set(allergiesRows.map((a) => a.tagName))];
      const dto = toHouseholdDto(fullHousehold, ctx.user.id, allergies);

      await householdEmitter.emitToUser(ctx.user.id, "created", { household: dto! });

      const userInfo = {
        id: ctx.user.id,
        name: ctx.user.name ?? null,
        isAdmin: false,
        version: versionedMembership.version,
      } as HouseholdUserInfo;

      await householdEmitter.emitToHousehold(householdId, "userJoined", { user: userInfo });

      await invalidateHouseholdCacheForUsers([ctx.user.id, ...existingMemberIds]);
      deferConnectionInvalidation(ctx.user.id, "household-joined");

      return appliedAck({ householdId });
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to join household");
      throw err;
    }
  });

const leave = authedProcedure
  .input(LeaveHouseholdInputSchema)
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { householdId, version } = input;

    log.info({ userId: ctx.user.id, householdId }, "Leaving household");

    const household = await getHouseholdForUser(ctx.user.id);

    if (!household || household.id !== householdId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not in this household",
      });
    }

    // Check if user is admin with other members
    if (household.adminUserId === ctx.user.id && household.users.length > 1) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "You must transfer admin privileges before leaving. Go to Household Settings to assign a new admin.",
      });
    }

    // Store remaining member IDs from the already-fetched household data
    const remainingMemberIds = household.users.filter((u) => u.id !== ctx.user.id).map((u) => u.id);

    try {
      const result = await removeUserFromHousehold(householdId, ctx.user.id, version);

      if (result.stale) {
        log.info(
          { userId: ctx.user.id, householdId, version },
          "Ignoring stale household leave mutation"
        );

        return staleAck();
      }

      log.info({ userId: ctx.user.id, householdId }, "User left household");

      await invalidateHouseholdCacheForUsers([ctx.user.id, ...remainingMemberIds]);

      for (const memberId of remainingMemberIds) {
        await householdEmitter.emitToUser(memberId, "userLeft", { userId: ctx.user.id });
      }

      deferConnectionInvalidation(ctx.user.id, "household-left");

      return appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to leave household");
      throw err;
    }
  });

const kick = authedProcedure
  .input(KickHouseholdUserInputSchema)
  .output(mutationAckSchema)
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

    // Get remaining member IDs for cache invalidation
    const remainingMemberIds =
      household?.users.filter((u) => u.id !== userIdToKick).map((u) => u.id) ?? [];

    try {
      const result = await kickUserFromHousehold(householdId, userIdToKick, ctx.user.id, version);

      if (result.stale) {
        log.info(
          { userId: ctx.user.id, householdId, userIdToKick, version },
          "Ignoring stale household kick mutation"
        );

        return staleAck();
      }

      log.info({ userId: ctx.user.id, householdId, userIdToKick }, "User kicked from household");

      await householdEmitter.emitToUser(userIdToKick, "userKicked", {
        householdId,
        kickedBy: ctx.user.id,
      });

      const recipePolicy = await getRecipePermissionPolicy();

      await permissionsEmitter.emitToUser(userIdToKick, "policyUpdated", { recipePolicy });

      await householdEmitter.emitToHousehold(householdId, "memberRemoved", {
        userId: userIdToKick,
      });

      await invalidateHouseholdCacheForUsers([userIdToKick, ...remainingMemberIds]);
      deferConnectionInvalidation(userIdToKick, "household-kicked");

      return appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to kick user");
      throw err;
    }
  });

const regenerateCode = authedProcedure
  .input(RegenerateHouseholdJoinCodeInputSchema)
  .output(mutationAckSchema)
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

    try {
      const result = await regenerateJoinCode(householdId, version);

      if (result.stale || !result.value) {
        log.info(
          { userId: ctx.user.id, householdId, version },
          "Ignoring stale household join-code regeneration"
        );

        return staleAck();
      }

      const household = result.value;

      log.info({ userId: ctx.user.id, householdId }, "Join code regenerated");

      await householdEmitter.emitToHousehold(householdId, "joinCodeRegenerated", {
        joinCode: household.joinCode!,
        joinCodeExpiresAt: household.joinCodeExpiresAt!.toISOString(),
        version: household.version,
      });

      return appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to regenerate join code");
      throw err;
    }
  });

const transferAdmin = authedProcedure
  .input(TransferHouseholdAdminInputSchema)
  .output(mutationAckSchema)
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

    try {
      const result = await transferHouseholdAdmin(householdId, ctx.user.id, newAdminId, version);

      if (result.stale || !result.value) {
        log.info(
          { userId: ctx.user.id, householdId, newAdminId, version },
          "Ignoring stale household admin transfer"
        );

        return staleAck();
      }

      const household = result.value;

      log.info({ userId: ctx.user.id, householdId, newAdminId }, "Admin transferred");

      await householdEmitter.emitToHousehold(householdId, "adminTransferred", {
        oldAdminId: ctx.user.id,
        newAdminId,
        version: household.version,
      });

      return appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to transfer admin");
      throw err;
    }
  });

export const householdsRouter = router({
  get,
  create,
  join,
  leave,
  kick,
  regenerateCode,
  transferAdmin,
});
