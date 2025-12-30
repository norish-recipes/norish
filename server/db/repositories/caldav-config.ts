import type {
  UserCaldavConfigDto,
  UserCaldavConfigInsertDto,
  UserCaldavConfigDecryptedDto,
  SaveCaldavConfigInputDto,
} from "@/types/dto/caldav-config";

import { eq } from "drizzle-orm";

import { db } from "@/server/db/drizzle";
import { userCaldavConfig } from "@/server/db/schema";
import { encrypt, decrypt } from "@/server/auth/crypto";
import {
  UserCaldavConfigSelectSchema,
  SaveCaldavConfigInputSchema,
} from "@/server/db/zodSchemas/caldav-config";

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
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export async function saveCaldavConfig(
  userId: string,
  input: SaveCaldavConfigInputDto
): Promise<UserCaldavConfigDto> {
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

  const [row] = await db
    .insert(userCaldavConfig)
    .values(encrypted)
    .onConflictDoUpdate({
      target: userCaldavConfig.userId,
      set: {
        ...encrypted,
        updatedAt: new Date(),
      },
    })
    .returning();

  const result = UserCaldavConfigSelectSchema.safeParse(row);

  if (!result.success) throw new Error("Failed to save CalDAV config");

  return result.data;
}

export async function deleteCaldavConfig(userId: string): Promise<void> {
  await db.delete(userCaldavConfig).where(eq(userCaldavConfig.userId, userId));
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
