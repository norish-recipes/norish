import { desc, eq, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import { users } from "../schema/auth";
import { serverConfig } from "../schema/server-config";
import { ServerConfigKeys } from "../zodSchemas/server-config";
import { getConfig } from "./server-config";

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

/** The stored fingerprint of the current Master Key; a row holding none or an empty one is none. */
export async function getMasterKeyFingerprint(): Promise<string | null> {
  return (await getConfig<string>(ServerConfigKeys.MASTER_KEY_FINGERPRINT)) || null;
}

/** Store `fingerprint` unless a fingerprint is there already; the one the database holds after. */
export async function claimMasterKeyFingerprint(fingerprint: string): Promise<string | null> {
  await db
    .insert(serverConfig)
    .values({ key: ServerConfigKeys.MASTER_KEY_FINGERPRINT, value: fingerprint })
    .onConflictDoUpdate({
      target: serverConfig.key,
      set: { value: fingerprint, updatedAt: new Date() },
      setWhere: or(isNull(serverConfig.value), eq(serverConfig.value, "")),
    });

  return getMasterKeyFingerprint();
}
