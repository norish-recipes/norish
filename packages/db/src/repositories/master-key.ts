import { desc, isNotNull } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { users } from "../schema/auth";
import { serverConfig } from "../schema/server-config";

const secretSetting = isNotNull(serverConfig.valueEnc);

/** Rows that hold encrypted data: every account and every secret setting; the rest belong to an account. */
export async function countEncryptedRows(): Promise<number> {
  const [accounts, secrets] = await Promise.all([
    db.$count(users),
    db.$count(serverConfig, secretSetting),
  ]);

  return accounts + secrets;
}

/** What to try a key on: the newest account's email, else the newest secret setting. */
export async function findNewestCiphertext(): Promise<string | null> {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(1);

  if (user) return user.email;

  const [setting] = await db
    .select({ valueEnc: serverConfig.valueEnc })
    .from(serverConfig)
    .where(secretSetting)
    .orderBy(desc(serverConfig.updatedAt))
    .limit(1);

  return setting?.valueEnc ?? null;
}
