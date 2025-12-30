import type { User } from "@/types";

import { eq, and, inArray } from "drizzle-orm";

import { db } from "../drizzle";
import { users, accounts } from "../schema/auth";
import { ServerConfigKeys } from "../zodSchemas/server-config";

import { setConfig } from "./server-config";

import { encrypt, hmacIndex, decrypt } from "@/server/auth/crypto";
import { authLogger } from "@/server/logger";

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

  await db.update(users).set(payload).where(eq(users.id, user.id));

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

export async function getUserById(userId: string): Promise<User | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
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
  };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const lookup = hmacIndex(email);
  const user = await db.query.users.findFirst({
    where: eq(users.emailHmac, lookup),
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      emailVerified: true,
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
  };
}

export async function updateUserAvatar(userId: string, protectedPath: string): Promise<void> {
  const encryptedImage = encrypt(protectedPath);

  await db.update(users).set({ image: encryptedImage }).where(eq(users.id, userId));
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

export async function clearUserAvatar(userId: string): Promise<void> {
  await db.update(users).set({ image: null }).where(eq(users.id, userId));
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

export async function updateUserName(userId: string, name: string): Promise<void> {
  const encryptedName = encrypt(name);

  await db.update(users).set({ name: encryptedName }).where(eq(users.id, userId));
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
): Promise<{ id: string; name: string | null; image: string | null } | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      name: true,
      image: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name ? decrypt(user.name) : null,
    image: user.image ? decrypt(user.image) : null,
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
    })
    .where(eq(users.id, userId));
}

export async function setUserAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
  await db.update(users).set({ isServerAdmin: isAdmin }).where(eq(users.id, userId));
}

export async function countUsers(): Promise<number> {
  const result = await db.select({ id: users.id }).from(users);

  return result.length;
}

/**
 * Get user's locale preference
 */
export async function getUserLocale(userId: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      locale: true,
    },
  });

  return user?.locale ?? null;
}

/**
 * Update user's locale preference
 */
export async function updateUserLocale(userId: string, locale: string | null): Promise<void> {
  await db.update(users).set({ locale }).where(eq(users.id, userId));
}
