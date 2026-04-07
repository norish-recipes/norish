import { and, eq, sql } from "drizzle-orm";

import type {
  HouseholdDto,
  HouseholdInsertDto,
  HouseholdUserDto,
  HouseholdUserInsertDto,
  HouseholdWithUsersNamesDto,
} from "@norish/shared/contracts/dto/household";
import { db } from "@norish/db/drizzle";
import { households, householdUsers } from "@norish/db/schema";
import {
  HouseholdInsertBaseSchema,
  HouseholdSelectBaseSchema,
  HouseholdUserInsertBaseSchema,
  HouseholdUserSelectBaseSchema,
  HouseholdWithUsersNamesSchema,
} from "@norish/shared/contracts/zod/household";

import type { MutationOutcome } from "./mutation-outcomes";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { getUsersByIds } from "./users";

export async function getUsersByHouseholdId(householdId: string): Promise<HouseholdUserDto[]> {
  const rows = await db.query.householdUsers.findMany({
    where: eq(householdUsers.householdId, householdId),
  });

  return rows;
}

export async function createHousehold(input: HouseholdInsertDto): Promise<HouseholdDto> {
  const parsed = HouseholdInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid HouseholdInsertDto");

  // generate a unique 6-digit code with 10-minute expiration
  const code = await generateUniqueJoinCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const [row] = await db
    .insert(households)
    .values({ ...parsed.data, joinCode: code, joinCodeExpiresAt: expiresAt })
    .returning();
  const validated = HouseholdSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse created household");

  return validated.data;
}

export async function deleteHousehold(id: string): Promise<void> {
  await db.delete(households).where(eq(households.id, id));
}

export async function getHouseholdById(id: string): Promise<HouseholdDto | null> {
  const rows = await db.select().from(households).where(eq(households.id, id)).limit(1);
  const parsed = HouseholdSelectBaseSchema.safeParse(rows[0]);

  return parsed.success ? parsed.data : null;
}

/**
 * Get the single household for a user
 * Users are only allowed to be in one household at a time
 */
export async function getHouseholdForUser(
  userId: string
): Promise<HouseholdWithUsersNamesDto | null> {
  const rows = (await db.query.householdUsers.findFirst({
    where: eq(householdUsers.userId, userId),
    columns: { householdId: true },
    with: {
      household: {
        columns: {
          id: true,
          name: true,
          adminUserId: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          joinCode: true,
          joinCodeExpiresAt: true,
        },
        with: {
          users: {
            columns: { userId: true, version: true },
          },
        },
      },
    },
  })) as any;

  if (!rows?.household) return null;

  const h = rows.household;
  const members = (h.users ?? []) as Array<{ userId: string; version: number }>;
  const allUserIds = members.map((m) => m.userId);

  const usersRows = await getUsersByIds(allUserIds);

  const idToName = new Map(usersRows.map((u) => [u.id, u.name]));

  const mapped = {
    id: h.id,
    name: h.name,
    adminUserId: h.adminUserId,
    version: h.version,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    joinCode: h.joinCode,
    joinCodeExpiresAt: h.joinCodeExpiresAt,
    users: members.map((member) => ({
      id: member.userId,
      name: idToName.get(member.userId) ?? null,
      isAdmin: member.userId === h.adminUserId,
      version: member.version,
    })),
  };

  const parsed = HouseholdWithUsersNamesSchema.safeParse(mapped);

  if (!parsed.success) throw new Error("Failed to parse household for user");

  return parsed.data;
}

/**
 * Gets all member IDs in the user's household (including the user)
 * If user is not in a household, returns just the user's ID
 */
export async function getHouseholdMemberIds(userId: string): Promise<string[]> {
  const household = await getHouseholdForUser(userId);
  const memberIds = Array.from(new Set([userId, ...(household?.users.map((u) => u.id) ?? [])]));

  return memberIds;
}

export async function addUserToHousehold(input: HouseholdUserInsertDto): Promise<HouseholdUserDto> {
  const parsed = HouseholdUserInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid HouseholdUserInsertDto");

  // Check if user is already in a household
  const existingHousehold = await getHouseholdForUser(parsed.data.userId);

  if (existingHousehold) {
    throw new Error("User is already in a household. Leave the current household first.");
  }

  const [row] = await db
    .insert(householdUsers)
    .values(parsed.data as any)
    .onConflictDoNothing()
    .returning();

  const resolved = row
    ? row
    : (
        await db
          .select()
          .from(householdUsers)
          .where(
            and(
              eq(householdUsers.householdId, parsed.data.householdId),
              eq(householdUsers.userId, parsed.data.userId)
            )
          )
          .limit(1)
      )[0];

  const validated = HouseholdUserSelectBaseSchema.safeParse(resolved);

  if (!validated.success) throw new Error("Failed to add user to household");

  return validated.data;
}

export async function removeUserFromHousehold(
  householdId: string,
  userId: string,
  version?: number
): Promise<MutationOutcome<void>> {
  return await db.transaction(async (tx) => {
    const whereConditions = [
      eq(householdUsers.householdId, householdId),
      eq(householdUsers.userId, userId),
    ];

    if (version) {
      whereConditions.push(eq(householdUsers.version, version));
    }

    const deletedMembership = await tx
      .delete(householdUsers)
      .where(and(...whereConditions))
      .returning({ userId: householdUsers.userId });

    if (deletedMembership.length === 0) {
      return staleOutcome();
    }

    const rows = await tx
      .select({ count: sql<number>`count(*)` })
      .from(householdUsers)
      .where(eq(householdUsers.householdId, householdId));

    const count = Number(rows?.[0]?.count ?? 0);

    if (count === 0) {
      await tx.delete(households).where(eq(households.id, householdId));
    }

    return appliedOutcome(undefined);
  });
}

export async function findHouseholdByJoinCode(code: string): Promise<HouseholdDto | null> {
  const rows = await db
    .select()
    .from(households)
    .where(eq(households.joinCode as any, code))
    .limit(1);
  const parsed = HouseholdSelectBaseSchema.safeParse(rows[0]);

  return parsed.success ? parsed.data : null;
}

export async function joinHouseholdByCode(
  userId: string,
  code: string
): Promise<HouseholdUserDto | null> {
  const household = await findHouseholdByJoinCode(code);

  if (!household) return null;

  return addUserToHousehold({ householdId: household.id, userId });
}

/**
 * Regenerates the join code for a household with a new 10-minute expiration
 */
export async function regenerateJoinCode(
  householdId: string,
  version?: number
): Promise<MutationOutcome<HouseholdDto>> {
  const code = await generateUniqueJoinCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const whereConditions = [eq(households.id, householdId)];

  if (version) {
    whereConditions.push(eq(households.version, version));
  }

  const [row] = await db
    .update(households)
    .set({
      joinCode: code,
      joinCodeExpiresAt: expiresAt,
      updatedAt: new Date(),
      version: sql`${households.version} + 1`,
    })
    .where(and(...whereConditions))
    .returning();

  if (!row) {
    return staleOutcome();
  }

  const validated = HouseholdSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to regenerate join code");

  return appliedOutcome(validated.data);
}

/**
 * Checks if a user is the admin of a household
 */
export async function isUserHouseholdAdmin(householdId: string, userId: string): Promise<boolean> {
  const household = await getHouseholdById(householdId);

  return household?.adminUserId === userId;
}

/**
 * Kicks a user from a household (admin only)
 */
export async function kickUserFromHousehold(
  householdId: string,
  userIdToKick: string,
  adminUserId: string,
  version?: number
): Promise<MutationOutcome<void>> {
  // Verify admin
  const isAdmin = await isUserHouseholdAdmin(householdId, adminUserId);

  if (!isAdmin) {
    throw new Error("Only the household admin can kick members");
  }

  // Cannot kick yourself
  if (userIdToKick === adminUserId) {
    throw new Error("Admin cannot kick themselves. Transfer admin first or leave the household.");
  }

  return await removeUserFromHousehold(householdId, userIdToKick, version);
}

/**
 * Transfers admin privileges to another member
 */
export async function transferHouseholdAdmin(
  householdId: string,
  currentAdminId: string,
  newAdminId: string,
  version?: number
): Promise<MutationOutcome<HouseholdDto>> {
  // Verify current admin
  const isAdmin = await isUserHouseholdAdmin(householdId, currentAdminId);

  if (!isAdmin) {
    throw new Error("Only the current admin can transfer admin privileges");
  }

  // Verify new admin is a member
  const members = await getUsersByHouseholdId(householdId);
  const isMember = members.some((m) => m.userId === newAdminId);

  if (!isMember) {
    throw new Error("New admin must be a member of the household");
  }

  const whereConditions = [eq(households.id, householdId)];

  if (version) {
    whereConditions.push(eq(households.version, version));
  }

  const [row] = await db
    .update(households)
    .set({
      adminUserId: newAdminId,
      updatedAt: new Date(),
      version: sql`${households.version} + 1`,
    })
    .where(and(...whereConditions))
    .returning();

  if (!row) {
    return staleOutcome();
  }

  const validated = HouseholdSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to transfer admin");

  return appliedOutcome(validated.data);
}

/**
 * Find a household by name (case-insensitive)
 */
export async function findHouseholdByName(name: string): Promise<HouseholdDto | null> {
  const normalizedName = name.toLowerCase().trim();

  const rows = await db
    .select()
    .from(households)
    .where(sql`LOWER(${households.name}) = ${normalizedName}`)
    .limit(1);

  const parsed = HouseholdSelectBaseSchema.safeParse(rows[0]);

  return parsed.success ? parsed.data : null;
}

/**
 * Find existing household by name or create a new one
 * Used for OIDC claim-based household assignment
 */
export async function findOrCreateHouseholdByName(
  name: string,
  creatorUserId: string
): Promise<HouseholdDto> {
  const normalizedName = name.trim();

  // Try to find existing (case-insensitive)
  const existing = await findHouseholdByName(normalizedName);

  if (existing) return existing;

  // Create new household with this user as admin
  const code = await generateUniqueJoinCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const [row] = await db
    .insert(households)
    .values({
      name: normalizedName,
      adminUserId: creatorUserId,
      joinCode: code,
      joinCodeExpiresAt: expiresAt,
    })
    .returning();

  const validated = HouseholdSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to create household");

  return validated.data;
}

async function generateUniqueJoinCode(): Promise<string> {
  while (true) {
    const code = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0");

    const existing = await db
      .select({ id: households.id })
      .from(households)
      .where(eq(households.joinCode as any, code))
      .limit(1);

    if (existing.length === 0) return code;
  }
}
