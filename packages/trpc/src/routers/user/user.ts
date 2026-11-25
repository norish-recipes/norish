import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { deleteUserAccount } from "@norish/auth/account-deletion";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  clearUserAvatar,
  getAllergiesForUsers,
  getApiKeysForUser,
  getSignInMethodsForUser,
  getUserAllergies,
  getUserById,
  getUserPreferences,
  getUserProfile,
  setUserDevicePreferences,
  updateUserAllergies,
  updateUserAvatar,
  updateUserName,
  updateUserPreferences,
} from "@norish/db";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  deleteAvatarByFilename,
  sweepUserAvatars,
} from "@norish/shared-server/media/avatar-cleanup";
import { households } from "@norish/shared-server/realtime/households";
import { IMAGE_MIME_TO_EXTENSION } from "@norish/shared/contracts";
import {
  DeleteUserAvatarInputSchema,
  SetDevicePreferencesInputSchema,
  UpdateUserNameInputSchema,
  UpdateUserPreferencesInputSchema,
} from "@norish/shared/contracts/zod";
import { deviceBlocks } from "@norish/shared/contracts/zod/device-preferences";
import { UpdateUserAllergiesSchema } from "@norish/shared/contracts/zod/user-allergies";
import { avatarFilenameFromImagePath, buildAvatarFilename } from "@norish/shared/lib/helpers";

import { formDataInputSchema, getUploadedFile } from "../../form-data";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * Tell every open household client (the actor's other tabs included — no echo
 * suppression, ADR-0021) that a member's profile picture changed.
 */
function emitMemberProfileUpdated(
  ctx: { user: { id: string }; householdId: string },
  image: string | null
) {
  void households.publish(
    "memberProfileUpdated",
    {
      userId: ctx.user.id,
      image,
    },
    { householdId: ctx.householdId }
  );
}

/** The profile with its account-wide preferences only; Device Preferences have their own read. */
async function getProfileWithoutDevicePreferences(userId: string) {
  const profile = await getUserProfile(userId);

  if (!profile) return null;

  const { phone: _phone, desktop: _desktop, ...preferences } = profile.preferences ?? {};

  return { ...profile, preferences };
}

/**
 * Get current user settings (user profile + API keys). The Device Preferences
 * are left to getDevicePreferences, so the client holds one copy.
 */
const get = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting user settings");

  const freshUser = await getProfileWithoutDevicePreferences(ctx.user.id);
  const apiKeys = await getApiKeysForUser(ctx.user.id);

  return {
    user: {
      id: ctx.user.id,
      email: freshUser?.email ?? ctx.user.email,
      name: freshUser?.name ?? ctx.user.name,
      image: freshUser ? freshUser.image : ctx.user.image,
      version: freshUser?.version ?? 1,
      preferences: freshUser?.preferences ?? {},
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
 * Update the person's own preferences (language, after-planning,
 * measurements). Only the keys given are written, merged in the database:
 * reading the document, merging in memory and writing it back would put back a
 * stale copy of the Device Preferences a toggle wrote in between.
 */
const updatePreferences = authedProcedure
  .input(UpdateUserPreferencesInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, updates: input.preferences }, "Updating user preferences");

    const result = await updateUserPreferences(ctx.user.id, input.preferences, input.version);

    if (result.stale) {
      log.info(
        { userId: ctx.user.id, version: input.version },
        "Ignoring stale user preferences mutation"
      );

      const storedUser = await getUserProfile(ctx.user.id);
      const { locale, afterPlanning, measurementSystem } = storedUser?.preferences ?? {};

      return {
        success: true,
        stale: true,
        preferences: { locale, afterPlanning, measurementSystem },
        version: storedUser?.version ?? input.version,
      };
    }

    return {
      success: true,
      preferences: input.preferences,
      version: result.value,
    };
  });

/** The reader's Device Preferences: each Device Kind's block, the defaults where none is stored. */
const getDevicePreferences = authedProcedure.query(async ({ ctx }) =>
  deviceBlocks(await getUserPreferences(ctx.user.id))
);

/**
 * Set Device Preferences for the named Device Kind. The kind travels in the
 * input so an Outbox Replay lands on the kind the change was made on; the
 * last writer wins, outside the profile's version.
 */
const setDevicePreferences = authedProcedure
  .input(SetDevicePreferencesInputSchema)
  .mutation(async ({ ctx, input }) => {
    log.debug(
      { userId: ctx.user.id, kind: input.kind, updates: input.preferences },
      "Setting device preferences"
    );

    await setUserDevicePreferences(ctx.user.id, input.kind, input.preferences);

    return { success: true };
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

    if (!result.value) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      user: result.value,
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

  if (!result.value) {
    return { success: false, error: "User not found" };
  }

  emitMemberProfileUpdated(ctx, protectedPath);

  log.info({ userId: ctx.user.id, path: protectedPath }, "Avatar uploaded");

  return {
    success: true,
    user: result.value,
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

    if (!clearResult.value) {
      return { success: false, error: "User not found" };
    }

    emitMemberProfileUpdated(ctx, null);

    log.info({ userId: ctx.user.id }, "Avatar deleted");

    return {
      success: true,
      user: clearResult.value,
    };
  });

/**
 * Delete the reader's own account, as an admin's removal does: an admin's role passes to the
 * longest-standing member, and a last member takes the household along.
 */
const deleteAccount = authedProcedure.mutation(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Deleting account");

  await deleteUserAccount(ctx.user.id);

  log.info({ userId: ctx.user.id }, "Account deleted");

  return { success: true };
});

/**
 * Get current user's allergies
 */
const signInMethods = authedProcedure.query(({ ctx }) => getSignInMethodsForUser(ctx.user.id));

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

    const allergiesRows = await getAllergiesForUsers(ctx.userIds);
    const allergies = [...new Set(allergiesRows.map((a) => a.tagName))];

    log.info({ householdId: ctx.householdId, allergies }, "Emitting allergiesUpdated to household");
    void households.publish("allergiesUpdated", { allergies }, { householdId: ctx.householdId });

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
  signInMethods,
  getAllergies,
  setAllergies,
  updatePreferences,
  getDevicePreferences,
  setDevicePreferences,
});
