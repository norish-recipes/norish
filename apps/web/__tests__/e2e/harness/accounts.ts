import type { BrowserContext } from "@playwright/test";

import { deleteHousehold, getHouseholdForUser } from "@norish/db/repositories/households";
import { deleteUser, getUserByEmail } from "@norish/db/repositories/users";

import type { HarnessUser } from "./production-stack";

/** The id of an account the stack signed up. */
export async function userIdOf(user: Pick<HarnessUser, "email">): Promise<string> {
  const found = await getUserByEmail(user.email);

  if (!found) throw new Error(`The harness has not provisioned ${user.email}`);

  return found.id;
}

/**
 * A test's cleanup: closes its contexts, then deletes its users and their households.
 * `allSettled` lets every close run, and a failed close is rethrown only after the deletions.
 */
export async function closeAndDelete(
  contexts: readonly BrowserContext[],
  users: readonly { id: string }[]
): Promise<void> {
  const closed = await Promise.allSettled(contexts.map((context) => context.close()));

  for (const user of users) {
    const household = await getHouseholdForUser(user.id);

    if (household) await deleteHousehold(household.id);
    await deleteUser(user.id);
  }

  const failed = closed.find((result) => result.status === "rejected");

  if (failed) throw failed.reason;
}
