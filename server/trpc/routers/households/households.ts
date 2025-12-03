import type { HouseholdSettingsDto, HouseholdAdminSettingsDto } from "@/types/dto/household";
import type { HouseholdUserInfo } from "./types";

import { z } from "zod";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

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
} from "@/server/db";
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
  userId: string
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
    } as HouseholdAdminSettingsDto;
  }

  return {
    id: household.id,
    name: household.name,
    users,
  } as HouseholdSettingsDto;
}

const get = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting household settings");

  const household = await getHouseholdForUser(ctx.user.id);
  const dto = toHouseholdDto(household, ctx.user.id);

  log.debug({ userId: ctx.user.id, hasHousehold: !!dto }, "Household settings retrieved");

  return { household: dto, currentUserId: ctx.user.id };
});

const create = authedProcedure
  .input(z.object({ name: HouseholdNameSchema }))
  .mutation(async ({ ctx, input }) => {
    const name = (input.name ?? "My Household").trim();
    const id = crypto.randomUUID();

    log.info({ userId: ctx.user.id, name }, "Creating household");

    try {
      // Check if user is already in a household
      const existingHousehold = await getHouseholdForUser(ctx.user.id);

      if (existingHousehold) {
        throw new Error("You are already in a household. Leave it first to create a new one.");
      }

      // Create household and add user
      const household = await createHousehold({ name, adminUserId: ctx.user.id });
      await addUserToHousehold({ householdId: household.id, userId: ctx.user.id });

      log.info({ userId: ctx.user.id, householdId: household.id }, "Household created");

      // Get full household data with users
      const fullHousehold = await getHouseholdForUser(ctx.user.id);
      const dto = toHouseholdDto(fullHousehold, ctx.user.id);

      // Emit to the user who created the household
      householdEmitter.emitToUser(ctx.user.id, "created", { household: dto! });

      return { id };
    } catch (err) {
      log.error({ err, userId: ctx.user.id }, "Failed to create household");
      householdEmitter.emitToUser(ctx.user.id, "failed", {
        reason: "Failed to create household",
      });
      throw err;
    }
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
      throw new Error("You are already in a household. Leave it first to join another one.");
    }

    // Find household by code
    const household = await findHouseholdByJoinCode(cleaned);

    if (!household) {
      throw new Error("Invalid join code");
    }

    // Check if code is expired
    if (household.joinCodeExpiresAt && new Date(household.joinCodeExpiresAt) < new Date()) {
      throw new Error("This join code has expired");
    }

    const householdId = household.id;

    // Add user to household
    await addUserToHousehold({ householdId, userId: ctx.user.id });

    log.info({ userId: ctx.user.id, householdId }, "User joined household");

    // Get full household for the joining user
    const fullHousehold = await getHouseholdForUser(ctx.user.id);
    const dto = toHouseholdDto(fullHousehold, ctx.user.id);

    // Emit to the joining user
    householdEmitter.emitToUser(ctx.user.id, "created", { household: dto! });

    // Emit to existing household members
    const userInfo: HouseholdUserInfo = {
      id: ctx.user.id,
      name: ctx.user.name ?? null,
      isAdmin: false,
    };

    householdEmitter.emitToHousehold(householdId, "userJoined", { user: userInfo });

    return { householdId };
  });

const leave = authedProcedure
  .input(z.object({ householdId: UUIDSchema }))
  .mutation(async ({ ctx, input }) => {
    const { householdId } = input;

    log.info({ userId: ctx.user.id, householdId }, "Leaving household");

    const household = await getHouseholdForUser(ctx.user.id);

    if (!household || household.id !== householdId) {
      throw new Error("You are not in this household");
    }

    // Check if user is admin with other members
    if (household.adminUserId === ctx.user.id && household.users.length > 1) {
      throw new Error(
        "You must transfer admin privileges before leaving. Go to Household Settings to assign a new admin."
      );
    }

    // Store remaining member IDs from the already-fetched household data
    const remainingMemberIds = household.users.filter((u) => u.id !== ctx.user.id).map((u) => u.id);

    // Remove user from household
    await removeUserFromHousehold(householdId, ctx.user.id);

    log.info({ userId: ctx.user.id, householdId }, "User left household");

    // Emit to remaining members
    for (const memberId of remainingMemberIds) {
      householdEmitter.emitToUser(memberId, "userLeft", { userId: ctx.user.id });
    }

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
      throw new Error("Only the household admin can kick members");
    }

    if (userIdToKick === ctx.user.id) {
      throw new Error("You cannot kick yourself");
    }

    // Verify the user is actually in the household
    const household = await getHouseholdForUser(ctx.user.id);
    const kickedUser = household?.users.find((u) => u.id === userIdToKick);

    if (!kickedUser) {
      throw new Error("User is not a member of this household");
    }

    // Kick user from household
    await kickUserFromHousehold(householdId, userIdToKick, ctx.user.id);

    log.info({ userId: ctx.user.id, householdId, userIdToKick }, "User kicked from household");

    // Emit to the kicked user (user-scoped)
    householdEmitter.emitToUser(userIdToKick, "userKicked", {
      householdId,
      kickedBy: ctx.user.id,
    });

    // Emit to remaining household members (household-scoped)
    householdEmitter.emitToHousehold(householdId, "memberRemoved", { userId: userIdToKick });

    // Emit policyUpdated to kicked user so their recipe view refreshes
    // (they lose access to household recipes)
    const recipePolicy = await getRecipePermissionPolicy();

    permissionsEmitter.emitToUser(userIdToKick, "policyUpdated", { recipePolicy });

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
      throw new Error("Only the household admin can regenerate the join code");
    }

    // Regenerate join code
    const updatedHousehold = await regenerateJoinCode(householdId);

    log.info({ userId: ctx.user.id, householdId }, "Join code regenerated");

    // Emit to all household members
    householdEmitter.emitToHousehold(householdId, "joinCodeRegenerated", {
      joinCode: updatedHousehold.joinCode!,
      joinCodeExpiresAt: updatedHousehold.joinCodeExpiresAt!.toISOString(),
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
      throw new Error("Only the current admin can transfer admin privileges");
    }

    if (newAdminId === ctx.user.id) {
      throw new Error("You are already the admin");
    }

    // Transfer admin privileges
    await transferHouseholdAdmin(householdId, ctx.user.id, newAdminId);

    log.info({ userId: ctx.user.id, householdId, newAdminId }, "Admin transferred");

    // Emit to all household members
    householdEmitter.emitToHousehold(householdId, "adminTransferred", {
      oldAdminId: ctx.user.id,
      newAdminId,
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
