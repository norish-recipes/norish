import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { AdminUserRowDTO, User } from "@norish/shared/contracts";
import { decrypt, encrypt, hmacIndex } from "@norish/config/crypto";
import { db } from "@norish/db/drizzle";
import { authLogger } from "@norish/db/logger";

import type { MutationOutcome } from "./mutation-outcomes";
import { accounts, users } from "../schema/auth";
import { householdUsers } from "../schema/household-users";
import { households } from "../schema/households";
import { ServerConfigKeys } from "../zodSchemas/server-config";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { setConfig } from "./server-config";

export type VersionedUser = User & { version: number };

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

/**
 * The identity a request is authorised with.
 *
 * `isServerAdmin` folds in server ownership, matching {@link isUserServerAdmin}.
 */
export type SessionIdentity = VersionedUser & { isServerAdmin: boolean };

/**
 * Load the identity behind a session, in a single query.
 *
 * Session payloads are cached outside the database and carry a snapshot of the
 * user row taken at sign-in, so they outlive both the row itself and any change
 * to its privileges. Anything that authorises a request must resolve the user
 * through here rather than trusting that snapshot.
 */
export async function getUserSessionIdentity(userId: string): Promise<SessionIdentity | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      version: true,
      isServerOwner: true,
      isServerAdmin: true,
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
    isServerAdmin: user.isServerOwner || user.isServerAdmin,
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

/**
 * List every user on the server for the admin user management page.
 * Each user is in at most one household, so the left join can't fan out.
 */
export async function listUsersForAdmin(): Promise<AdminUserRowDTO[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      isServerOwner: users.isServerOwner,
      isServerAdmin: users.isServerAdmin,
      createdAt: users.createdAt,
      householdId: households.id,
      householdName: households.name,
    })
    .from(users)
    .leftJoin(householdUsers, eq(householdUsers.userId, users.id))
    .leftJoin(households, eq(households.id, householdUsers.householdId))
    .orderBy(desc(users.isServerOwner), desc(users.isServerAdmin), users.createdAt);

  return rows.map((row) => ({
    id: row.id,
    email: decrypt(row.email),
    name: row.name ? decrypt(row.name) : "",
    image: row.image ? decrypt(row.image) : null,
    isServerOwner: row.isServerOwner,
    isServerAdmin: row.isServerAdmin,
    createdAt: row.createdAt.getTime(),
    household:
      row.householdId && row.householdName
        ? { id: row.householdId, name: row.householdName }
        : null,
  }));
}

/**
 * The server roles a user holds, or null when there is no such user.
 * Callers that only need a yes/no want `isUserServerAdmin`.
 */
export async function getUserRoleFlags(
  userId: string
): Promise<{ isServerOwner: boolean; isServerAdmin: boolean } | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      isServerOwner: true,
      isServerAdmin: true,
    },
  });

  return user ?? null;
}

export async function isUserServerAdmin(userId: string): Promise<boolean> {
  const roles = await getUserRoleFlags(userId);

  if (!roles) {
    return false;
  }

  return roles.isServerOwner || roles.isServerAdmin;
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

export async function isUserServerOwner(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isServerOwner: true },
  });

  return user?.isServerOwner ?? false;
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
