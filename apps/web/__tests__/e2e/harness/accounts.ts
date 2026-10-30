import { getUserByEmail } from "@norish/db/repositories/users";

import type { HarnessUser } from "./production-stack";

/** The id of an account the stack signed up. */
export async function userIdOf(user: Pick<HarnessUser, "email">): Promise<string> {
  const found = await getUserByEmail(user.email);

  if (!found) throw new Error(`The harness has not provisioned ${user.email}`);

  return found.id;
}
