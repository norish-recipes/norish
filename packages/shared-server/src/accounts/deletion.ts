import { getHouseholdForUser, transferHouseholdAdmin } from "@norish/db/repositories/households";
import { deleteUser } from "@norish/db/repositories/users";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { sweepUserAvatars } from "@norish/shared-server/media/avatar-cleanup";
import { emitConnectionInvalidation } from "@norish/shared-server/realtime/connection-invalidation";

/**
 * Hand a household on before its admin is deleted.
 *
 * `households.admin_user_id` is `ON DELETE cascade`, so deleting the admin
 * takes the household row with it — and `household_users.household_id`
 * cascades in turn, so every other member silently loses the household they
 * share their recipes, groceries and meal plan through. Passing the household
 * to somebody who is staying keeps it intact.
 *
 * Which member inherits it is arbitrary: nobody left has a stronger claim than
 * anyone else, and the household's own settings let them hand it on again. A
 * household with nobody left in it is allowed to go with the cascade.
 */
async function passOnHousehold(userId: string): Promise<void> {
  const household = await getHouseholdForUser(userId);

  if (!household || household.adminUserId !== userId) {
    return;
  }

  const successor = household.users.find((member) => member.id !== userId);

  if (!successor) {
    return;
  }

  await transferHouseholdAdmin(household.id, userId, successor.id);
  log.info(
    { userId, householdId: household.id, successorId: successor.id },
    "Passed household on before deleting its admin"
  );
}

/**
 * Delete an account and settle everything that hangs off it: the household it
 * administers, its avatar files on disk, and its live connections.
 *
 * Every path that removes an account goes through here — a user closing their
 * own account and an administrator removing someone else's — so the two can
 * never drift into leaving different debris behind.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  await passOnHousehold(userId);
  await sweepUserAvatars(userId);
  await deleteUser(userId);

  // After the row is gone, so a client that reconnects on the invalidation
  // finds the account already absent rather than briefly still there.
  await emitConnectionInvalidation(userId, "account-deleted");
}
