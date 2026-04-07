import { and, eq, sql } from "drizzle-orm";

import type {
  SaveCaldavConfigInputDto,
  UserCaldavConfigDecryptedDto,
  UserCaldavConfigDto,
  UserCaldavConfigInsertDto,
} from "@norish/shared/contracts/dto/caldav-config";
import { decrypt, encrypt } from "@norish/auth/crypto";
import { db } from "@norish/db/drizzle";
import { userCaldavConfig } from "@norish/db/schema";
import {
  SaveCaldavConfigInputSchema,
  UserCaldavConfigSelectSchema,
} from "@norish/shared/contracts/zod/caldav-config";

import type { MutationOutcome } from "./mutation-outcomes";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";

export async function getCaldavConfigByUserId(userId: string): Promise<UserCaldavConfigDto | null> {
  const rows = await db
    .select()
    .from(userCaldavConfig)
    .where(eq(userCaldavConfig.userId, userId))
    .limit(1);

  const row = rows[0];

  if (!row) return null;

  const validated = UserCaldavConfigSelectSchema.safeParse(row);

  if (!validated.success) throw new Error("Invalid CalDAV config data");

  return validated.data;
}

export async function getCaldavConfigDecrypted(
  userId: string
): Promise<UserCaldavConfigDecryptedDto | null> {
  const config = await getCaldavConfigByUserId(userId);

  if (!config) return null;

  return {
    userId: config.userId,
    serverUrl: decrypt(config.serverUrlEnc),
    calendarUrl: config.calendarUrlEnc ? decrypt(config.calendarUrlEnc) : null,
    username: decrypt(config.usernameEnc),
    password: decrypt(config.passwordEnc),
    enabled: config.enabled,
    breakfastTime: config.breakfastTime,
    lunchTime: config.lunchTime,
    dinnerTime: config.dinnerTime,
    snackTime: config.snackTime,
    version: config.version,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

/**
 * Get CalDAV config without password (for security)
 * Password should only be retrieved when explicitly needed
 */
export async function getCaldavConfigWithoutPassword(
  userId: string
): Promise<Omit<UserCaldavConfigDecryptedDto, "password"> | null> {
  const config = await getCaldavConfigByUserId(userId);

  if (!config) return null;

  return {
    userId: config.userId,
    serverUrl: decrypt(config.serverUrlEnc),
    calendarUrl: config.calendarUrlEnc ? decrypt(config.calendarUrlEnc) : null,
    username: decrypt(config.usernameEnc),
    enabled: config.enabled,
    breakfastTime: config.breakfastTime,
    lunchTime: config.lunchTime,
    dinnerTime: config.dinnerTime,
    snackTime: config.snackTime,
    version: config.version,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export async function saveCaldavConfig(
  userId: string,
  input: SaveCaldavConfigInputDto
): Promise<MutationOutcome<UserCaldavConfigDto>> {
  const validated = SaveCaldavConfigInputSchema.safeParse(input);

  if (!validated.success) throw new Error("Invalid CalDAV config input");

  const encrypted: UserCaldavConfigInsertDto = {
    userId,
    serverUrlEnc: encrypt(validated.data.serverUrl),
    calendarUrlEnc: validated.data.calendarUrl ? encrypt(validated.data.calendarUrl) : null,
    usernameEnc: encrypt(validated.data.username),
    passwordEnc: encrypt(validated.data.password),
    enabled: validated.data.enabled,
    breakfastTime: validated.data.breakfastTime,
    lunchTime: validated.data.lunchTime,
    dinnerTime: validated.data.dinnerTime,
    snackTime: validated.data.snackTime,
  };
  const requestedVersion = (input as { version?: number }).version;

  const existing = await getCaldavConfigByUserId(userId);

  let row: UserCaldavConfigDto | undefined;

  if (!existing) {
    [row] = await db.insert(userCaldavConfig).values(encrypted).returning();
  } else {
    const whereConditions = [eq(userCaldavConfig.userId, userId)];

    if (requestedVersion) {
      whereConditions.push(eq(userCaldavConfig.version, requestedVersion));
    }

    [row] = await db
      .update(userCaldavConfig)
      .set({
        ...encrypted,
        updatedAt: new Date(),
        version: sql`${userCaldavConfig.version} + 1`,
      })
      .where(and(...whereConditions))
      .returning();
  }

  if (!row) {
    return staleOutcome();
  }

  const result = UserCaldavConfigSelectSchema.safeParse(row);

  if (!result.success) throw new Error("Failed to save CalDAV config");

  return appliedOutcome(result.data);
}

export async function deleteCaldavConfig(
  userId: string,
  version?: number
): Promise<MutationOutcome<void>> {
  const whereConditions = [eq(userCaldavConfig.userId, userId)];

  if (version) {
    whereConditions.push(eq(userCaldavConfig.version, version));
  }

  const deleted = await db
    .delete(userCaldavConfig)
    .where(and(...whereConditions))
    .returning({ userId: userCaldavConfig.userId });

  if (deleted.length === 0 && version) {
    return staleOutcome();
  }

  return appliedOutcome(undefined);
}

export async function getEnabledCaldavConfigs(): Promise<UserCaldavConfigDto[]> {
  const rows = await db.select().from(userCaldavConfig).where(eq(userCaldavConfig.enabled, true));

  return rows.map((row) => {
    const validated = UserCaldavConfigSelectSchema.safeParse(row);

    if (!validated.success) throw new Error("Invalid CalDAV config data");

    return validated.data;
  });
}

export async function getHouseholdCaldavConfigs(
  userIds: string[]
): Promise<Map<string, UserCaldavConfigDecryptedDto>> {
  if (userIds.length === 0) return new Map();

  const rows = await db.select().from(userCaldavConfig).where(eq(userCaldavConfig.enabled, true));

  const configMap = new Map<string, UserCaldavConfigDecryptedDto>();

  for (const row of rows) {
    if (!userIds.includes(row.userId)) continue;

    const decrypted: UserCaldavConfigDecryptedDto = {
      userId: row.userId,
      serverUrl: decrypt(row.serverUrlEnc),
      calendarUrl: row.calendarUrlEnc ? decrypt(row.calendarUrlEnc) : null,
      username: decrypt(row.usernameEnc),
      password: decrypt(row.passwordEnc),
      enabled: row.enabled,
      breakfastTime: row.breakfastTime,
      lunchTime: row.lunchTime,
      dinnerTime: row.dinnerTime,
      snackTime: row.snackTime,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    // Use serverUrl as key for deduplication
    const existingUserId = configMap.get(decrypted.serverUrl)?.userId;

    if (!existingUserId) {
      configMap.set(decrypted.serverUrl, decrypted);
    }
  }

  return configMap;
}
