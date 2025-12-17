import type { HouseholdSettingsDto, HouseholdAdminSettingsDto } from "@/types/dto/household";
import type { HouseholdUserInfo } from "./types";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";
import { emitConnectionInvalidation } from "../../connection-manager";

import { householdEmitter } from "./emitter";

import {
  getHouseholdForUser,
  findHouseholdByJoinCode,
  createHousehold,
  addUserToHousehold,
  removeUserFromHousehold,
  kickUserFromHousehold,
  regenerateJoinCode,
  transferHouseholdAdmin,
  isUserHouseholdAdmin,
  getAllergiesForUsers,
  getUsersByHouseholdId,
} from "@/server/db";
import {
  invalidateHouseholdCache,
  invalidateHouseholdCacheForUsers,
} from "@/server/db/cached-household";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";
import {
  HouseholdNameSchema,
  JoinCodeSchema,
  UUIDSchema,
  UserIdSchema,
} from "@/lib/validation/schemas";
import { trpcLogger as log } from "@/server/logger";
import { permissionsEmitter } from "@/server/trpc/routers/permissions/emitter";

/**
 * Transforms household data to DTO based on admin status
 */
function toHouseholdDto(
  household: Awaited<ReturnType<typeof getHouseholdForUser>>,
  userId: string,
  allergies: string[]
): HouseholdSettingsDto | HouseholdAdminSettingsDto | null {
  if (!household) return null;

  const isAdmin = household.adminUserId === userId;
  const now = new Date();
  const isJoinCodeExpired =
    !household.joinCodeExpiresAt || new Date(household.joinCodeExpiresAt) < now;

  const users = household.users.map((u) => ({
    id: u.id,
    name: u.name ?? null,
    isAdmin: u.isAdmin ?? u.id === household.adminUserId,
  }));

  if (isAdmin) {
    return {
      id: household.id,
      name: household.name,
      joinCode: isJoinCodeExpired ? null : household.joinCode,
      joinCodeExpiresAt: isJoinCodeExpired ? null : household.joinCodeExpiresAt,
      users,
      allergies,
    } as HouseholdAdminSettingsDto;
  }

  return {
    id: household.id,
    name: household.name,
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
  .mutation(async ({ ctx, input }) => {
    const name = (input.name ?? "My Household").trim();
    const id = crypto.randomUUID();

    log.info({ userId: ctx.user.id, name }, "Creating household");

    // Check if user is already in a household
    const existingHousehold = await getHouseholdForUser(ctx.user.id);

    if (existingHousehold) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You are already in a household. Leave it first to create a new one.",
      });
    }

    // Create household async and emit events
    createHousehold({ name, adminUserId: ctx.user.id })
      .then(async (household) => {
        await addUserToHousehold({ householdId: household.id, userId: ctx.user.id });

        // Auto-generate join code for new household
        await regenerateJoinCode(household.id);

        log.info({ userId: ctx.user.id, householdId: household.id }, "Household created");

        // Get full household data with users (after join code generated)
        const fullHousehold = await getHouseholdForUser(ctx.user.id);
        const userIds = fullHousehold?.users.map((u) => u.id) ?? [];
        const allergiesRows = await getAllergiesForUsers(userIds);
        const allergies = [...new Set(allergiesRows.map((a) => a.tagName))];
        const dto = toHouseholdDto(fullHousehold, ctx.user.id, allergies);

        // Emit to the user who created the household
        // This MUST happen before connection invalidation so client receives it
        householdEmitter.emitToUser(ctx.user.id, "created", { household: dto! });

        // Invalidate cache and terminate connection to rebind subscriptions
        // The client already has the household data from the event above
        await invalidateHouseholdCache(ctx.user.id);
        await emitConnectionInvalidation(ctx.user.id, "household-created");
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Failed to create household");
        householdEmitter.emitToUser(ctx.user.id, "failed", {
          reason: "Failed to create household",
        });
      });

    return { id };
  });

const join = authedProcedure
  .input(z.object({ code: z.string() }))
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

    // Add user async and emit events
    addUserToHousehold({ householdId, userId: ctx.user.id })
      .then(async () => {
        log.info({ userId: ctx.user.id, householdId }, "User joined household");

        // Get full household for the joining user
        const fullHousehold = await getHouseholdForUser(ctx.user.id);
        const userIds = fullHousehold?.users.map((u) => u.id) ?? [];
        const allergiesRows = await getAllergiesForUsers(userIds);
        const allergies = [...new Set(allergiesRows.map((a) => a.tagName))];
        const dto = toHouseholdDto(fullHousehold, ctx.user.id, allergies);

        // Emit to the joining user FIRST (before connection invalidation)
        householdEmitter.emitToUser(ctx.user.id, "created", { household: dto! });

        // Emit to existing household members
        const userInfo: HouseholdUserInfo = {
          id: ctx.user.id,
          name: ctx.user.name ?? null,
          isAdmin: false,
        };
        householdEmitter.emitToHousehold(householdId, "userJoined", { user: userInfo });

        // Invalidate cache and terminate connection AFTER events are sent
        await invalidateHouseholdCacheForUsers([ctx.user.id, ...existingMemberIds]);
        await emitConnectionInvalidation(ctx.user.id, "household-joined");
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Failed to join household");
        householdEmitter.emitToUser(ctx.user.id, "failed", {
          reason: "Failed to join household",
        });
      });

    return { householdId };
  });

const leave = authedProcedure
  .input(z.object({ householdId: UUIDSchema }))
  .mutation(async ({ ctx, input }) => {
    const { householdId } = input;

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

    // Remove user async and emit events - fire and forget
    removeUserFromHousehold(householdId, ctx.user.id)
      .then(async () => {
        log.info({ userId: ctx.user.id, householdId }, "User left household");

        // Invalidate cache for leaving user AND remaining members (their user list changed)
        await invalidateHouseholdCacheForUsers([ctx.user.id, ...remainingMemberIds]);

        // Terminate connection to rebind subscriptions (now user-only channels)
        await emitConnectionInvalidation(ctx.user.id, "household-left");

        // Emit to remaining members
        for (const memberId of remainingMemberIds) {
          householdEmitter.emitToUser(memberId, "userLeft", { userId: ctx.user.id });
        }
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Failed to leave household");
        householdEmitter.emitToUser(ctx.user.id, "failed", {
          reason: "Failed to leave household",
        });
      });

    return { success: true };
  });

const kick = authedProcedure
  .input(z.object({ householdId: UUIDSchema, userId: UserIdSchema }))
  .mutation(async ({ ctx, input }) => {
    const { householdId, userId: userIdToKick } = input;

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
    const remainingMemberIds = household?.users.filter((u) => u.id !== userIdToKick).map((u) => u.id) ?? [];

    // Kick user async and emit events
    kickUserFromHousehold(householdId, userIdToKick, ctx.user.id)
      .then(async () => {
        log.info({ userId: ctx.user.id, householdId, userIdToKick }, "User kicked from household");

        // Emit to the kicked user FIRST (before their connection is terminated)
        householdEmitter.emitToUser(userIdToKick, "userKicked", {
          householdId,
          kickedBy: ctx.user.id,
        });

        // Emit policyUpdated to kicked user so their recipe view refreshes
        // (they lose access to household recipes)
        const recipePolicy = await getRecipePermissionPolicy();
        permissionsEmitter.emitToUser(userIdToKick, "policyUpdated", { recipePolicy });

        // Emit to remaining household members (household-scoped)
        householdEmitter.emitToHousehold(householdId, "memberRemoved", { userId: userIdToKick });

        // Invalidate cache and terminate connection AFTER events are sent
        await invalidateHouseholdCacheForUsers([userIdToKick, ...remainingMemberIds]);
        await emitConnectionInvalidation(userIdToKick, "household-kicked");
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Failed to kick user");
        householdEmitter.emitToUser(ctx.user.id, "failed", {
          reason: "Failed to kick user from household",
        });
      });

    return { success: true };
  });

const regenerateCode = authedProcedure
  .input(z.object({ householdId: UUIDSchema }))
  .mutation(async ({ ctx, input }) => {
    const { householdId } = input;

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
    regenerateJoinCode(householdId)
      .then((household) => {
        log.info({ userId: ctx.user.id, householdId }, "Join code regenerated");

        // Emit to all household members
        householdEmitter.emitToHousehold(householdId, "joinCodeRegenerated", {
          joinCode: household.joinCode!,
          joinCodeExpiresAt: household.joinCodeExpiresAt!.toISOString(),
        });
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Failed to regenerate join code");
        householdEmitter.emitToUser(ctx.user.id, "failed", {
          reason: "Failed to regenerate join code",
        });
      });

    return { success: true };
  });

const transferAdmin = authedProcedure
  .input(z.object({ householdId: UUIDSchema, newAdminId: UserIdSchema }))
  .mutation(async ({ ctx, input }) => {
    const { householdId, newAdminId } = input;

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
    transferHouseholdAdmin(householdId, ctx.user.id, newAdminId)
      .then(() => {
        log.info({ userId: ctx.user.id, householdId, newAdminId }, "Admin transferred");

        // Emit to all household members
        householdEmitter.emitToHousehold(householdId, "adminTransferred", {
          oldAdminId: ctx.user.id,
          newAdminId,
        });
      })
      .catch((err) => {
        log.error({ err, userId: ctx.user.id }, "Failed to transfer admin");
        householdEmitter.emitToUser(ctx.user.id, "failed", {
          reason: "Failed to transfer admin privileges",
        });
      });

    return { success: true };
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
