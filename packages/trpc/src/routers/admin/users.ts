import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  deleteUser,
  getUserRoleFlags,
  listUsersForAdmin,
  setUserAdminStatus,
} from "@norish/db/repositories/users";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * List every user on the server, with their role flags and household.
 */
const list = adminProcedure.query(async () => {
  return listUsersForAdmin();
});

const SetAdminStatusInputSchema = z.object({
  userId: z.string(),
  isAdmin: z.boolean(),
});

/**
 * Grant or revoke server admin access for a user.
 * An admin can promote others, but can neither demote the server owner
 * (who is always admin) nor remove their own admin access.
 */
const setAdminStatus = adminProcedure
  .input(SetAdminStatusInputSchema)
  .mutation(async ({ input, ctx }) => {
    const { userId, isAdmin } = input;

    if (!isAdmin && userId === ctx.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You cannot remove your own admin access",
      });
    }

    const target = await getUserRoleFlags(userId);

    if (!target) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    if (target.isServerOwner) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The server owner always has admin access",
      });
    }

    log.info({ actingUserId: ctx.user.id, userId, isAdmin }, "Updating user admin status");

    await setUserAdminStatus(userId, isAdmin);

    return { success: true };
  });

const DeleteUserInputSchema = z.object({
  userId: z.string(),
});

/**
 * Delete a user from the server.
 * The server owner can't be deleted, and an admin can't delete themselves.
 */
const remove = adminProcedure.input(DeleteUserInputSchema).mutation(async ({ input, ctx }) => {
  const { userId } = input;

  if (userId === ctx.user.id) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "You cannot delete your own account here",
    });
  }

  const target = await getUserRoleFlags(userId);

  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  if (target.isServerOwner) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The server owner cannot be deleted",
    });
  }

  log.info({ actingUserId: ctx.user.id, userId }, "Deleting user");

  await deleteUser(userId);

  return { success: true };
});

export const usersProcedures = router({
  list,
  setAdminStatus,
  remove,
});
