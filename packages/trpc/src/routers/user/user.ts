import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  clearUserAvatar,
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
import { deleteUserAccount } from "@norish/shared-server/accounts/deletion";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  deleteAvatarByFilename,
  sweepUserAvatars,
} from "@norish/shared-server/media/avatar-cleanup";
import { IMAGE_MIME_TO_EXTENSION } from "@norish/shared/contracts";
import {
  DeleteUserAvatarInputSchema,
  UpdateUserNameInputSchema,
  UpdateUserPreferencesInputSchema,
  UserPreferencesSchema,
} from "@norish/shared/contracts/zod";
import { UpdateUserAllergiesSchema } from "@norish/shared/contracts/zod/user-allergies";
import { avatarFilenameFromImagePath, buildAvatarFilename } from "@norish/shared/lib/helpers";

import { formDataInputSchema, getUploadedFile } from "../../form-data";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { householdEmitter } from "../households/emitter";

/**
 * Tell every open household client (the actor's other tabs included — no echo
 * suppression, ADR-0021) that a member's profile picture changed.
 */
function emitMemberProfileUpdated(
  ctx: { user: { id: string }; household: { id: string } | null },
  image: string | null
) {
  if (!ctx.household) {
    log.debug({ userId: ctx.user.id }, "No household, skipping memberProfileUpdated emit");

    return;
  }

  householdEmitter.emitToHousehold(ctx.household.id, "memberProfileUpdated", {
    userId: ctx.user.id,
    image,
  });
}

/**
 * Get current user settings (user profile + API keys)
 */
const get = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting user settings");

  const freshUser = await getUserById(ctx.user.id);
  const apiKeys = await getApiKeysForUser(ctx.user.id);
  const preferences = await getUserPreferences(ctx.user.id);
  const parsedPreferences = UserPreferencesSchema.safeParse(preferences);

  // completed DB reads

  return {
    user: {
      id: ctx.user.id,
      email: freshUser?.email ?? ctx.user.email,
      name: freshUser?.name ?? ctx.user.name,
      image: freshUser?.image ?? ctx.user.image,
      version: freshUser?.version ?? 1,
      preferences: parsedPreferences.success ? parsedPreferences.data : {},
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
  .input(UpdateUserPreferencesInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, updates: input.preferences }, "Updating user preferences");

    const current = await getUserPreferences(ctx.user.id);
    const merged = { ...(current ?? {}), ...(input.preferences ?? {}) };

    const result = await updateUserPreferences(ctx.user.id, merged, input.version);

    if (result.stale) {
      log.info(
        { userId: ctx.user.id, version: input.version },
        "Ignoring stale user preferences mutation"
      );

      return {
        success: true,
        stale: true,
        preferences: current ?? {},
        version: input.version,
      };
    }

    const updatedUser = await getUserById(ctx.user.id);

    return {
      success: true,
      preferences: merged,
      version: updatedUser?.version ?? input.version,
    };
  });

/**
 * Update user name
 */
const updateName = authedProcedure
  .input(UpdateUserNameInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id }, "Updating user name");

    const trimmedName = input.name.trim();

    if (!trimmedName) {
      return { success: false, error: "Name cannot be empty" };
    }

    const result = await updateUserName(ctx.user.id, trimmedName, input.version);

    if (result.stale) {
      log.info(
        { userId: ctx.user.id, version: input.version },
        "Ignoring stale user name mutation"
      );

      return { success: true, stale: true };
    }

    const updatedUser = await getUserById(ctx.user.id);

    if (!updatedUser) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      user: updatedUser,
    };
  });

/**
 * Upload user avatar (FormData input)
 */
const uploadAvatar = authedProcedure.input(formDataInputSchema).mutation(async ({ ctx, input }) => {
  log.debug({ userId: ctx.user.id }, "Uploading avatar");

  const file = getUploadedFile(input, "file");
  const version = Number(input.get("version"));

  if (!file) {
    return { success: false, error: "No file provided" };
  }

  if (!Number.isInteger(version) || version < 1) {
    return { success: false, error: "Current user version is required" };
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

  // The DB-referenced file becomes the retained predecessor (ADR-0021), so
  // read it fresh rather than trusting the session snapshot.
  const currentUser = await getUserById(ctx.user.id);
  const predecessorFilename = avatarFilenameFromImagePath(currentUser?.image);

  // Every upload mints a new versioned filename (ADR-0021)
  const filename = buildAvatarFilename(ctx.user.id, ext);
  const filepath = path.join(avatarDir, filename);

  await writeFile(filepath, buffer);

  // Use auth-protected URL pattern
  const protectedPath = `/avatars/${filename}`;

  // Update database
  const result = await updateUserAvatar(ctx.user.id, protectedPath, version);

  if (result.stale) {
    await deleteAvatarByFilename(filename);
    log.info({ userId: ctx.user.id, version }, "Ignoring stale user avatar upload");

    return { success: true, stale: true };
  }

  // Sweep only after the DB points at the new file: keep it and its immediate
  // predecessor so payloads still holding the old URL keep rendering.
  await sweepUserAvatars(
    ctx.user.id,
    predecessorFilename ? [filename, predecessorFilename] : [filename]
  );

  const updatedUser = await getUserById(ctx.user.id);

  if (!updatedUser) {
    return { success: false, error: "User not found" };
  }

  emitMemberProfileUpdated(ctx, protectedPath);

  log.info({ userId: ctx.user.id, path: protectedPath }, "Avatar uploaded");

  return {
    success: true,
    user: updatedUser,
  };
});

/**
 * Delete user avatar
 */
const deleteAvatar = authedProcedure
  .input(DeleteUserAvatarInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id }, "Deleting avatar");

    const clearResult = await clearUserAvatar(ctx.user.id, input.version);

    if (clearResult.stale) {
      log.info(
        { userId: ctx.user.id, version: input.version },
        "Ignoring stale user avatar delete"
      );

      return { success: true, stale: true };
    }

    // Delete keeps nothing — no payload should render a removed picture
    await sweepUserAvatars(ctx.user.id);

    const updatedUser = await getUserById(ctx.user.id);

    if (!updatedUser) {
      return { success: false, error: "User not found" };
    }

    emitMemberProfileUpdated(ctx, null);

    log.info({ userId: ctx.user.id }, "Avatar deleted");

    return {
      success: true,
      user: updatedUser,
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

  await deleteUserAccount(ctx.user.id);

  log.info({ userId: ctx.user.id }, "Account deleted");

  return { success: true };
});

/**
 * Get current user's allergies
 */
const getAllergies = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting user allergies");

  const allergies = await getUserAllergies(ctx.user.id);

  return allergies;
});

/**
 * Update user allergies
 */
const setAllergies = authedProcedure
  .input(UpdateUserAllergiesSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, count: input.allergies.length }, "Updating user allergies");

    const result = await updateUserAllergies(ctx.user.id, input.allergies, input.version);

    if (result.stale) {
      log.info(
        { userId: ctx.user.id, version: input.version },
        "Ignoring stale user allergies mutation"
      );
      const currentAllergies = await getUserAllergies(ctx.user.id);

      return {
        success: true,
        stale: true,
        allergies: currentAllergies.allergies,
        version: currentAllergies.version,
      };
    }

    const updatedAllergies = await getUserAllergies(ctx.user.id);

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

    return {
      success: true,
      allergies: updatedAllergies.allergies,
      version: updatedAllergies.version,
    };
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
