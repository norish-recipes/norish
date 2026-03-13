import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";

import { z } from "zod";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  clearUserAvatar,
  deleteUser,
  getAllergiesForUsers,
  getApiKeysForUser,
  getHouseholdForUser,
  getUserAllergies,
  getUserById,
  getUserPreferences,
  updateUserAllergies,
  updateUserAvatar,
  updateUserName,
  updateUserPreferences,
} from "@norish/db";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { deleteAvatarByFilename } from "@norish/shared-server/media/avatar-cleanup";
import { IMAGE_MIME_TO_EXTENSION } from "@norish/shared/contracts";
import { UpdateUserAllergiesSchema } from "@norish/shared/contracts/zod/user-allergies";
import { buildAvatarFilename, isAvatarFilenameForUser } from "@norish/shared/lib/helpers";

import { emitConnectionInvalidation } from "../../connection-manager";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { householdEmitter } from "../households/emitter";

import { UpdateNameInputSchema, UpdatePreferencesInputSchema } from "./types";

/**
 * Get current user settings (user profile + API keys)
 */
const get = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting user settings");

  const freshUser = await getUserById(ctx.user.id);
  const apiKeys = await getApiKeysForUser(ctx.user.id);
  const preferences = await getUserPreferences(ctx.user.id);

  // completed DB reads

  return {
    user: {
      id: ctx.user.id,
      email: freshUser?.email ?? ctx.user.email,
      name: freshUser?.name ?? ctx.user.name,
      image: freshUser?.image ?? ctx.user.image,
      preferences: preferences as any,
    },
    apiKeys: apiKeys.map((k) => ({
      id: k.id,
      name: k.name,
      start: k.start,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      enabled: k.enabled,
    })),
  };
});
/**
 * Update user preferences
 */

const updatePreferences = authedProcedure
  .input(UpdatePreferencesInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, updates: input.preferences }, "Updating user preferences");

    const current = await getUserPreferences(ctx.user.id);
    const merged = { ...(current ?? {}), ...(input.preferences ?? {}) };

    await updateUserPreferences(ctx.user.id, merged);

    return { success: true, preferences: merged };
  });

/**
 * Update user name
 */
const updateName = authedProcedure.input(UpdateNameInputSchema).mutation(async ({ ctx, input }) => {
  log.debug({ userId: ctx.user.id }, "Updating user name");

  const trimmedName = input.name.trim();

  if (!trimmedName) {
    return { success: false, error: "Name cannot be empty" };
  }

  await updateUserName(ctx.user.id, trimmedName);

  return {
    success: true,
    user: {
      ...ctx.user,
      name: trimmedName,
    },
  };
});

/**
 * Upload user avatar (FormData input)
 */
const uploadAvatar = authedProcedure
  .input(z.instanceof(FormData))
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id }, "Uploading avatar");

    const file = input.get("file") as File | null;

    if (!file) {
      return { success: false, error: "No file provided" };
    }

    // Validate mime type
    const ext = IMAGE_MIME_TO_EXTENSION[file.type];

    if (!ext) {
      return {
        success: false,
        error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
      };
    }

    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate file size
    if (buffer.length > SERVER_CONFIG.MAX_AVATAR_FILE_SIZE) {
      return { success: false, error: "File too large. Maximum size is 5MB." };
    }

    // Create avatars directory
    const avatarDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "avatars");

    await mkdir(avatarDir, { recursive: true });

    // Delete all previous avatars for this user (they might have different extensions)
    try {
      const existingFiles = await readdir(avatarDir);
      const userAvatars = existingFiles.filter((f) => isAvatarFilenameForUser(f, ctx.user.id));

      for (const oldAvatar of userAvatars) {
        await deleteAvatarByFilename(oldAvatar);
      }
    } catch {
      // Ignore errors if directory doesn't exist or files can't be read
    }

    // Use user ID as filename
    const filename = buildAvatarFilename(ctx.user.id, ext);
    const filepath = path.join(avatarDir, filename);

    await writeFile(filepath, buffer);

    // Use auth-protected URL pattern
    const protectedPath = `/avatars/${filename}`;

    // Update database
    await updateUserAvatar(ctx.user.id, protectedPath);

    log.info({ userId: ctx.user.id, path: protectedPath }, "Avatar uploaded");

    return {
      success: true,
      user: {
        ...ctx.user,
        image: protectedPath,
      },
    };
  });

/**
 * Delete user avatar
 */
const deleteAvatar = authedProcedure.mutation(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Deleting avatar");

  const avatarDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "avatars");

  // Delete all avatars for this user
  try {
    const existingFiles = await readdir(avatarDir);
    const userAvatars = existingFiles.filter((f) => isAvatarFilenameForUser(f, ctx.user.id));

    for (const avatar of userAvatars) {
      await deleteAvatarByFilename(avatar);
    }
  } catch {
    // Ignore errors
  }

  // Clear from database
  await clearUserAvatar(ctx.user.id);

  log.info({ userId: ctx.user.id }, "Avatar deleted");

  return {
    success: true,
    user: {
      ...ctx.user,
      image: null,
    },
  };
});

/**
 * Delete user account
 */
const deleteAccount = authedProcedure.mutation(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Deleting account");

  // Check if user is admin of household with other members
  const household = await getHouseholdForUser(ctx.user.id);

  if (household && household.adminUserId === ctx.user.id) {
    const memberCount = household.users.length;

    if (memberCount > 1) {
      return {
        success: false,
        error:
          "You cannot delete your account while you are the admin of a household with other members. Transfer admin privileges first or have all members leave.",
      };
    }
  }

  // Delete user avatars
  const avatarDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "avatars");

  try {
    const existingFiles = await readdir(avatarDir);
    const userAvatars = existingFiles.filter((f) => isAvatarFilenameForUser(f, ctx.user.id));

    for (const avatar of userAvatars) {
      await deleteAvatarByFilename(avatar);
    }
  } catch {
    // Ignore errors
  }

  await deleteUser(ctx.user.id);

  // Terminate WebSocket connections so client doesn't stay connected
  await emitConnectionInvalidation(ctx.user.id, "account-deleted");

  log.info({ userId: ctx.user.id }, "Account deleted");

  return { success: true };
});

/**
 * Get current user's allergies
 */
const getAllergies = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting user allergies");

  const allergies = await getUserAllergies(ctx.user.id);

  return { allergies };
});

/**
 * Update user allergies
 */
const setAllergies = authedProcedure
  .input(UpdateUserAllergiesSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, count: input.allergies.length }, "Updating user allergies");

    await updateUserAllergies(ctx.user.id, input.allergies);

    if (ctx.household) {
      const userIds = ctx.household.users.map((u) => u.id);
      const allergiesRows = await getAllergiesForUsers(userIds);
      const allergies = [...new Set(allergiesRows.map((a) => a.tagName))];

      log.info(
        { householdId: ctx.household.id, allergies },
        "Emitting allergiesUpdated to household"
      );
      householdEmitter.emitToHousehold(ctx.household.id, "allergiesUpdated", { allergies });
    } else {
      log.info({ userId: ctx.user.id }, "No household, skipping allergiesUpdated emit");
    }

    log.info({ userId: ctx.user.id, allergies: input.allergies }, "User allergies updated");

    return { success: true, allergies: input.allergies };
  });

export const userProcedures = router({
  get,
  updateName,
  uploadAvatar,
  deleteAvatar,
  deleteAccount,
  getAllergies,
  setAllergies,
  updatePreferences,
});
