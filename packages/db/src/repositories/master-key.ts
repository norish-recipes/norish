import { desc, isNotNull } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { users } from "../schema/auth";
import { serverConfig } from "../schema/server-config";

/**
 * What the instance's key wrote last: the newest account's email, else the newest secret setting.
 * Null on an instance that holds nothing encrypted; every other encrypted row belongs to an account.
 */
export async function findNewestEncryptedValue(): Promise<string | null> {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(1);

  if (user) return user.email;

  const [setting] = await db
    .select({ valueEnc: serverConfig.valueEnc })
    .from(serverConfig)
    .where(isNotNull(serverConfig.valueEnc))
    .orderBy(desc(serverConfig.updatedAt))
    .limit(1);

  return setting?.valueEnc ?? null;
}
