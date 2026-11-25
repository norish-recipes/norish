import type { AccountDeletion } from "@norish/db/repositories/households";
import { deleteAccount, getHouseholdById } from "@norish/db/repositories/households";
import { authLogger as log } from "@norish/shared-server/logger";
import { sweepUserAvatars } from "@norish/shared-server/media/avatar-cleanup";
import { sweepPendingUploadsOf } from "@norish/shared-server/media/pending-recipe-media";
import { deleteRecipeImagesDir, sweepCookbookImages } from "@norish/shared-server/media/storage";
import { policyAudience } from "@norish/shared-server/realtime/audience";
import { publishCalendarItemEvent } from "@norish/shared-server/realtime/calendar-items";
import { ACCOUNT_DELETED } from "@norish/shared-server/realtime/connection";
import { cookbooks } from "@norish/shared-server/realtime/cookbooks";
import { announceMembershipChange } from "@norish/shared-server/realtime/household-membership";
import { households } from "@norish/shared-server/realtime/households";
import { recipes } from "@norish/shared-server/realtime/recipes";
import { PlannedItemWithRecipePayloadSchema } from "@norish/shared/contracts/zod/planned-items";

import { auth } from "./auth";

/** What follows a committed deletion, named for the log when it fails. */
type Step = readonly [what: string, run: () => Promise<unknown>];

/** Long enough for a sweep; Valkey commands wait out an outage without a bound. */
const STEP_LIMIT_MS = 30_000;

function withinLimit(run: () => Promise<unknown>): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No answer in ${STEP_LIMIT_MS} ms`)), STEP_LIMIT_MS);
  });

  return Promise.race([run(), limit]).finally(() => clearTimeout(timer));
}

/** Runs each step in order, each within a time limit; a failure is logged and the rest run. */
async function runEach(userId: string, steps: Step[]): Promise<void> {
  for (const [what, run] of steps) {
    try {
      await withinLimit(run);
    } catch (err) {
      log.error({ err, userId }, `After an account deletion, could not ${what}`);
    }
  }
}

/**
 * The one way an account goes, its own or an admin's removal. Once the delete committed it
 * succeeds: sessions, Scope Change (ADR-0033), announcements and files each log their own failure.
 */
export async function deleteUserAccount(
  userId: string,
  /** The queue layer's, which this package cannot reach: its jobs and their payloads. */
  removeJobs: (userId: string, recipeIds: string[]) => Promise<void>
): Promise<void> {
  const deletion = await deleteAccount(userId);

  if (deletion.successorId)
    log.info({ userId, successorId: deletion.successorId }, "Passed household on");

  await runEach(userId, [
    // Sessions live in Valkey, which the row's cascade never reaches.
    [
      "end its sessions",
      async () => (await auth.$context).internalAdapter.deleteUserSessions(userId),
    ],
    // After the row is gone, so a client that reconnects finds the account already absent.
    [
      "announce it",
      () =>
        announceMembershipChange(
          { userId, reason: ACCOUNT_DELETED, affectedUserIds: deletion.memberIds },
          { toOthers: () => runEach(userId, announcements(userId, deletion)) }
        ),
    ],
    // Before the files, so no job waiting to run writes one after the sweep.
    ["remove its jobs", () => removeJobs(userId, deletion.recipeIds)],
    ["sweep its uploads for recipes never saved", () => sweepPendingUploadsOf(userId)],
    ["sweep its avatar", () => sweepUserAvatars(userId)],
    ...deletion.recipeIds.map((id): Step => [
      "sweep a recipe's files",
      () => deleteRecipeImagesDir(id),
    ]),
    ...deletion.cookbookIds.map((id): Step => [
      "sweep a cookbook's files",
      () => sweepCookbookImages(id),
    ]),
  ]);
}

/** The members who stay hear who went, then every reader hears of the erased and changed rows. */
function announcements(userId: string, deletion: AccountDeletion): Step[] {
  const { householdId, successorId } = deletion;

  if (!householdId) return [];

  let audience: ReturnType<typeof policyAudience> | undefined;
  const readers = () => (audience ??= policyAudience(householdId));
  const steps: Step[] = [];

  if (!deletion.householdErased) {
    steps.push([
      "tell the household who went",
      () => households.publish("memberRemoved", { userId }, { householdId }),
    ]);
  }
  if (!deletion.householdErased && successorId) {
    steps.push([
      "tell the household who took over",
      async () => {
        const household = await getHouseholdById(householdId);

        if (!household) return;
        await households.publish(
          "adminTransferred",
          { oldAdminId: userId, newAdminId: successorId, version: household.version },
          { householdId }
        );
      },
    ]);
  }
  if (deletion.recipeIds.length > 0) {
    steps.push([
      "announce its erased recipes",
      async () => recipes.publish("deleted", { ids: deletion.recipeIds }, await readers()),
    ]);
  }
  for (const id of deletion.cookbookIds) {
    steps.push([
      "announce an erased cookbook",
      async () => cookbooks.publish("deleted", { id }, await readers()),
    ]);
  }
  // As an edit: the household sees the note, and CalDAV retitles an event it synced (no link).
  for (const note of deletion.notes) {
    const item = { ...note, recipeName: null, recipeImage: null, servings: null, calories: null };

    steps.push([
      "announce a note",
      () =>
        publishCalendarItemEvent(
          "itemUpdated",
          { item: PlannedItemWithRecipePayloadSchema.parse(item) },
          note.householdId
        ),
    ]);
  }

  return steps;
}
