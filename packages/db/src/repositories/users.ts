import { and, eq, inArray, sql } from "drizzle-orm";

import type { User } from "@norish/shared/contracts/dto/user";
import { decrypt, encrypt, hmacIndex } from "@norish/auth/crypto";
import { authLogger } from "@norish/db/logger";

import type { MutationOutcome } from "./mutation-outcomes";
import { db } from "../drizzle";
import { accounts, users } from "../schema/auth";
import { ServerConfigKeys } from "../zodSchemas/server-config";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { setConfig } from "./server-config";

type VersionedUser = User & { version: number };

// BetterAuth-compatible user type for adapter operations
// Note: emailVerified is now a boolean in BetterAuth, not a Date
export interface AdapterUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
}

export async function createUser(
  user: Partial<AdapterUser> & { id: string }
): Promise<AdapterUser> {
  if (!user.id || !user.email || user.name === undefined) {
    throw new Error("User must have an id, email, and name");
  }

  // Check if this will be the first user BEFORE inserting
  const isFirstUser = (await countUsers()) === 0;

  const payload = {
    id: user.id,
    email: encrypt(user.email),
    emailHmac: hmacIndex(user.email),
    name: encrypt(user.name ?? ""),
    image: user.image ? encrypt(user.image) : null,
    emailVerified: user.emailVerified ?? false,
    // Set owner/admin flags for first user
    isServerOwner: isFirstUser,
    isServerAdmin: isFirstUser,
  };

  const [inserted] = await db.insert(users).values(payload).returning();

  if (!inserted) {
    throw new Error("Failed to create user");
  }

  // If first user, disable registration
  if (isFirstUser) {
    authLogger.info({ email: user.email }, "First user registered, set as server owner/admin");
    authLogger.info("Disabling registration after first user");
    await setConfig(ServerConfigKeys.REGISTRATION_ENABLED, false, user.id, false);
  }

  return {
    id: inserted.id,
    email: decrypt(inserted.email),
    name: inserted.name ? decrypt(inserted.name) : null,
    image: inserted.image ? decrypt(inserted.image) : null,
    emailVerified: inserted.emailVerified,
  };
}

export async function updateUser(
  user: Partial<AdapterUser> & { id: string }
): Promise<AdapterUser> {
  const payload: any = {};

  if (user.email !== undefined) {
    payload.email = user.email ? encrypt(user.email) : null;
    payload.emailHmac = user.email ? hmacIndex(user.email) : null;
  }
  if (user.name !== undefined) {
    payload.name = user.name ? encrypt(user.name) : null;
  }
  if (user.image !== undefined) {
    payload.image = user.image ? encrypt(user.image) : null;
  }
  if (user.emailVerified !== undefined) {
    payload.emailVerified = user.emailVerified;
  }

  if (Object.keys(payload).length > 0) {
    await db
      .update(users)
      .set({ ...payload, version: sql`${users.version} + 1` })
      .where(eq(users.id, user.id));
  }

  const updated = await getAdapterUserById(user.id);

  if (!updated) {
    throw new Error("User not found after update");
  }

  return updated;
}

export async function getAdapterUserById(userId: string): Promise<AdapterUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
      version: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ? decrypt(user.email) : "",
    name: user.name ? decrypt(user.name) : null,
    image: user.image ? decrypt(user.image) : null,
    emailVerified: user.emailVerified,
  };
}

export async function getAdapterUserByEmail(email: string): Promise<AdapterUser | null> {
  const lookup = hmacIndex(email);
  const user = await db.query.users.findFirst({
    where: eq(users.emailHmac, lookup),
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
      version: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ? decrypt(user.email) : "",
    name: user.name ? decrypt(user.name) : null,
    image: user.image ? decrypt(user.image) : null,
    emailVerified: user.emailVerified,
  };
}

export async function getUserById(userId: string): Promise<VersionedUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
      version: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: decrypt(user.email),
    name: user.name ? decrypt(user.name) : "",
    image: user.image ? decrypt(user.image) : null,
    version: user.version,
  };
}

export async function getUserByEmail(email: string): Promise<VersionedUser | null> {
  const lookup = hmacIndex(email);
  const user = await db.query.users.findFirst({
    where: eq(users.emailHmac, lookup),
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
      version: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: decrypt(user.email),
    name: user.name ? decrypt(user.name) : "",
    image: user.image ? decrypt(user.image) : null,
    version: user.version,
  };
}

export async function updateUserAvatar(
  userId: string,
  protectedPath: string,
  version?: number
): Promise<MutationOutcome<void>> {
  const encryptedImage = encrypt(protectedPath);
  const whereConditions = [eq(users.id, userId)];

  if (version) {
    whereConditions.push(eq(users.version, version));
  }

  const updated = await db
    .update(users)
    .set({ image: encryptedImage, version: sql`${users.version} + 1` })
    .where(and(...whereConditions))
    .returning({ id: users.id });

  if (updated.length === 0 && version) {
    return staleOutcome();
  }

  return appliedOutcome(undefined);
}

export async function getUserAvatarPath(userId: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      image: true,
    },
  });

  if (!user?.image) {
    return null;
  }

  return decrypt(user.image);
}

export async function getAllUserAvatars(): Promise<
  Array<{ userId: string; image: string | null }>
> {
  const usersWithAvatars = await db.query.users.findMany({
    columns: {
      id: true,
      image: true,
    },
  });

  return usersWithAvatars.map((u) => ({
    userId: u.id,
    image: u.image,
  }));
}

export async function clearUserAvatar(
  userId: string,
  version?: number
): Promise<MutationOutcome<void>> {
  const whereConditions = [eq(users.id, userId)];

  if (version) {
    whereConditions.push(eq(users.version, version));
  }

  const updated = await db
    .update(users)
    .set({ image: null, version: sql`${users.version} + 1` })
    .where(and(...whereConditions))
    .returning({ id: users.id });

  if (updated.length === 0 && version) {
    return staleOutcome();
  }

  return appliedOutcome(undefined);
}

export async function getAdapterUserByAccount(
  provider: string,
  providerAccountId: string
): Promise<AdapterUser | null> {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      emailVerified: users.emailVerified,
    })
    .from(accounts)
    .leftJoin(users, eq(users.id, accounts.userId))
    .where(and(eq(accounts.providerId, provider), eq(accounts.accountId, providerAccountId)))
    .limit(1);

  if (!result[0] || !result[0].id) {
    return null;
  }

  const user = result[0];

  return {
    id: user.id!,
    email: user.email ? decrypt(user.email) : "",
    name: user.name ? decrypt(user.name) : null,
    image: user.image ? decrypt(user.image) : null,
    emailVerified: user.emailVerified ?? false,
  };
}

export async function updateUserName(
  userId: string,
  name: string,
  version?: number
): Promise<MutationOutcome<void>> {
  const encryptedName = encrypt(name);
  const whereConditions = [eq(users.id, userId)];

  if (version) {
    whereConditions.push(eq(users.version, version));
  }

  const updated = await db
    .update(users)
    .set({ name: encryptedName, version: sql`${users.version} + 1` })
    .where(and(...whereConditions))
    .returning({ id: users.id });

  if (updated.length === 0 && version) {
    return staleOutcome();
  }

  return appliedOutcome(undefined);
}

export async function deleteUser(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

export async function getAllUserIds(): Promise<string[]> {
  const result = await db.select({ id: users.id }).from(users);

  return result.map((u) => u.id);
}

export async function getUsersByIds(
  userIds: string[]
): Promise<Array<{ id: string; name: string | null }>> {
  if (userIds.length === 0) {
    return [];
  }

  const result = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, userIds));

  return result.map((u) => ({
    id: u.id,
    name: u.name ? decrypt(u.name) : null,
  }));
}

export async function getUserAuthorInfo(
  userId: string
): Promise<{ id: string; name: string | null; image: string | null; version: number } | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      name: true,
      image: true,
      version: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name ? decrypt(user.name) : null,
    image: user.image ? decrypt(user.image) : null,
    version: user.version,
  };
}

export async function isUserServerAdmin(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      isServerOwner: true,
      isServerAdmin: true,
    },
  });

  if (!user) {
    return false;
  }

  return user.isServerOwner || user.isServerAdmin;
}

export async function getUserServerRole(
  userId: string
): Promise<{ isOwner: boolean; isAdmin: boolean }> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      isServerOwner: true,
      isServerAdmin: true,
    },
  });

  if (!user) {
    return { isOwner: false, isAdmin: false };
  }

  return {
    isOwner: user.isServerOwner,
    isAdmin: user.isServerAdmin,
  };
}

export async function setUserAsOwnerAndAdmin(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      isServerOwner: true,
      isServerAdmin: true,
      version: sql`${users.version} + 1`,
    })
    .where(eq(users.id, userId));
}

export async function setUserAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
  await db
    .update(users)
    .set({ isServerAdmin: isAdmin, version: sql`${users.version} + 1` })
    .where(eq(users.id, userId));
}

export async function countUsers(): Promise<number> {
  const result = await db.select({ id: users.id }).from(users);

  return result.length;
}

/**
 * Get user preferences (JSONB). If missing (pre-migration), return {} and warn.
 */
export async function getUserPreferences(userId: string): Promise<Record<string, unknown>> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { preferences: true },
    });

    return (user?.preferences as Record<string, unknown>) ?? {};
  } catch (error) {
    // Migration/column may be missing: warn and return empty preferences
    try {
      authLogger.warn(
        { userId, error },
        "Failed to read user.preferences; returning empty preferences (migration may be missing)"
      );
    } catch {
      // ignore logging errors
    }

    return {};
  }
}

/** Update user preferences by atomically merging provided JSONB updates. */
export async function updateUserPreferences(
  userId: string,
  updates: Record<string, unknown>,
  version?: number
): Promise<MutationOutcome<void>> {
  const updatesJson = JSON.stringify(updates ?? {});
  const whereConditions = [eq(users.id, userId)];

  if (version) {
    whereConditions.push(eq(users.version, version));
  }

  try {
    const updated = await db
      .update(users)
      .set({
        preferences: sql`coalesce(${users.preferences}, '{}'::jsonb) || ${updatesJson}::jsonb`,
        version: sql`${users.version} + 1`,
      })
      .where(and(...whereConditions))
      .returning({ id: users.id });

    if (updated.length === 0 && version) {
      return staleOutcome();
    }

    return appliedOutcome(undefined);
  } catch (error) {
    // Migration/column may be missing: warn and rethrow
    try {
      authLogger.warn(
        { userId, updates, error },
        "Failed to update user.preferences (migration may be missing)"
      );
    } catch {
      // ignore logging errors
    }

    throw error;
  }
}
