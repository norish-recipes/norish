import type { AccountDeletion } from "@norish/db/repositories/households";
import { deleteAccount, getHouseholdById } from "@norish/db/repositories/households";
import { authLogger as log } from "@norish/shared-server/logger";
import { sweepUserAvatars } from "@norish/shared-server/media/avatar-cleanup";
import { deleteRecipeImagesDir, sweepCookbookImages } from "@norish/shared-server/media/storage";
import { policyAudience } from "@norish/shared-server/realtime/audience";
import { publishCalendarItemEvent } from "@norish/shared-server/realtime/calendar-items";
import { cookbooks } from "@norish/shared-server/realtime/cookbooks";
import { announceMembershipChange } from "@norish/shared-server/realtime/household-membership";
import { households } from "@norish/shared-server/realtime/households";
import { recipes } from "@norish/shared-server/realtime/recipes";
import { PlannedItemWithRecipePayloadSchema } from "@norish/shared/contracts/zod/planned-items";

import { auth } from "./auth";

/**
 * Delete an account and settle everything that hangs off it once the deletion committed: its
 * sessions, its live connections (a Scope Change, ADR-0033), what everyone else hears, and the
 * files of what it erased.
 *
 * Every path that removes an account goes through here — a user closing their
 * own account and an administrator removing someone else's — so the two can
 * never drift into leaving different debris behind.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  const deletion = await deleteAccount(userId);

  if (deletion.successorId)
    log.info({ userId, successorId: deletion.successorId }, "Passed household on");

  try {
    // Sessions live in Valkey, which the row's cascade never reaches.
    await (await auth.$context).internalAdapter.deleteUserSessions(userId);
  } finally {
    try {
      // After the row is gone, so a client that reconnects finds the account already absent.
      await announceMembershipChange(
        { userId, reason: "account-deleted", affectedUserIds: deletion.memberIds },
        { toOthers: () => announceDeletion(userId, deletion) }
      );
    } finally {
      await sweepFiles(userId, deletion);
    }
  }
}

/** The members who stay hear who went, then every reader hears of the erased and changed rows. */
async function announceDeletion(userId: string, deletion: AccountDeletion): Promise<void> {
  const { householdId, successorId } = deletion;

  if (!householdId) return;
  if (!deletion.householdErased) {
    await households.publish("memberRemoved", { userId }, { householdId });

    const household = successorId ? await getHouseholdById(householdId) : null;

    if (successorId && household) {
      await households.publish(
        "adminTransferred",
        { oldAdminId: userId, newAdminId: successorId, version: household.version },
        { householdId }
      );
    }
  }

  const audience = await policyAudience(householdId);

  if (deletion.recipeIds.length > 0)
    await recipes.publish("deleted", { ids: deletion.recipeIds }, audience);
  for (const id of deletion.cookbookIds) await cookbooks.publish("deleted", { id }, audience);
  // As an edit: the household sees the note, and CalDAV retitles an event it synced (no link).
  for (const note of deletion.notes) {
    const item = PlannedItemWithRecipePayloadSchema.parse({
      ...note,
      recipeName: null,
      recipeImage: null,
      servings: null,
      calories: null,
    });

    await publishCalendarItemEvent("itemUpdated", { item }, note.householdId);
  }
}

/** A failed sweep is logged and left to the nightly orphan cleanup; the deletion stands. */
async function sweepFiles(userId: string, deletion: AccountDeletion): Promise<void> {
  const swept = await Promise.allSettled([
    sweepUserAvatars(userId),
    ...deletion.recipeIds.map((id) => deleteRecipeImagesDir(id)),
    ...deletion.cookbookIds.map((id) => sweepCookbookImages(id)),
  ]);

  for (const result of swept) {
    if (result.status === "rejected")
      log.warn({ err: result.reason, userId }, "Could not sweep a deleted account's files");
  }
}
