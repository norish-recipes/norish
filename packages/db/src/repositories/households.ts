import { randomInt } from "node:crypto";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { and, eq, inArray, sql } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import type {
  HouseholdDto,
  HouseholdUserDto,
  HouseholdWithUsersNamesDto,
} from "@norish/shared/contracts/dto/household";
import { db } from "@norish/db/drizzle";
import {
  cookbooks,
  groceries,
  households,
  householdUsers,
  ingredientAliases,
  ingredientNutritionCorrections,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  plannedItems,
  recipes,
  recurringGroceries,
  stores,
} from "@norish/db/schema";
import {
  HouseholdSelectBaseSchema,
  HouseholdUserSelectBaseSchema,
  HouseholdWithUsersNamesSchema,
} from "@norish/shared/contracts/zod/household";

import type { MutationOutcome } from "./mutation-outcomes";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { getUsersByIds } from "./users";

export { getHouseholdMemberIds, householdMemberIdsSql } from "./household-members";

export async function getUsersByHouseholdId(householdId: string): Promise<HouseholdUserDto[]> {
  const rows = await db.query.householdUsers.findMany({
    where: eq(householdUsers.householdId, householdId),
  });

  return rows;
}

/** What sign-up, the upgrade and leaving name a new household of one (migration 0088). */
export const NEW_HOUSEHOLD_NAME = "My household";

const JOIN_CODE_LIFETIME_MS = 10 * 60 * 1000;

/** The account's household; null only for an account that no longer exists. */
export async function getHouseholdIdForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ householdId: householdUsers.householdId })
    .from(householdUsers)
    .where(eq(householdUsers.userId, userId));

  return row?.householdId ?? null;
}

export async function isHouseholdMember(householdId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: householdUsers.userId })
    .from(householdUsers)
    .where(and(eq(householdUsers.householdId, householdId), eq(householdUsers.userId, userId)))
    .limit(1);

  return rows.length > 0;
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
  const rows = await db.query.householdUsers.findFirst({
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
  });

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

/** Everyone in the account's household, the account included. */
export async function getHouseholdMemberIdsForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: householdUsers.userId })
    .from(householdUsers)
    .where(
      inArray(
        householdUsers.householdId,
        db
          .select({ householdId: householdUsers.householdId })
          .from(householdUsers)
          .where(eq(householdUsers.userId, userId))
      )
    );

  return rows.map((row) => row.userId);
}

async function insertHouseholdOfOne(tx: DbTransaction, userId: string): Promise<HouseholdDto> {
  const [row] = await tx
    .insert(households)
    .values({
      name: NEW_HOUSEHOLD_NAME,
      adminUserId: userId,
      joinCode: await generateUniqueJoinCode(),
      joinCodeExpiresAt: new Date(Date.now() + JOIN_CODE_LIFETIME_MS),
    })
    .returning();

  await tx.insert(householdUsers).values({ householdId: row!.id, userId });

  return HouseholdSelectBaseSchema.parse(row);
}

/**
 * Takes a member out of a household and into a new household of one, in one
 * transaction, so no account is ever left without one. An emptied household goes.
 */
export async function moveToHouseholdOfOne(
  householdId: string,
  userId: string,
  version?: number
): Promise<MutationOutcome<HouseholdDto>> {
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

    const remaining = await tx
      .select({ userId: householdUsers.userId })
      .from(householdUsers)
      .where(eq(householdUsers.householdId, householdId))
      .limit(1);

    if (remaining.length === 0) {
      await tx.delete(households).where(eq(households.id, householdId));
    }

    return appliedOutcome(await insertHouseholdOfOne(tx, userId));
  });
}

/** What a household of one holds under its member's id, which joining cannot merge yet. */
const HELD_BY_MEMBER: ReadonlyArray<readonly [PgTable, AnyPgColumn]> = [
  [recipes, recipes.userId],
  [cookbooks, cookbooks.userId],
  [stores, stores.userId],
  [ingredientStorePreferences, ingredientStorePreferences.userId],
  [groceries, groceries.userId],
  [recurringGroceries, recurringGroceries.userId],
  [pantryIngredients, pantryIngredients.userId],
  [plannedItems, plannedItems.userId],
  [ingredientNutritionCorrections, ingredientNutritionCorrections.userId],
  [ingredients, ingredients.ownerId],
  [ingredientAliases, ingredientAliases.ownerId],
];

async function holdsAnything(tx: DbTransaction, userId: string): Promise<boolean> {
  for (const [table, owner] of HELD_BY_MEMBER) {
    const rows = await tx
      .select({ one: sql`1` })
      .from(table)
      .where(eq(owner, userId))
      .limit(1);

    if (rows.length > 0) return true;
  }

  return false;
}

export type JoinHouseholdOutcome =
  | { joined: HouseholdUserDto; leftHouseholdId: string }
  | { refused: "already-member" | "shared" | "holds-things" };

/**
 * Moves an account into another household, deleting the household of one it
 * leaves. Refused from a shared household (leave first) and, until merging
 * lands (ticket 09), from a household of one that holds anything.
 */
export async function joinHousehold(
  userId: string,
  householdId: string
): Promise<JoinHouseholdOutcome> {
  return await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ householdId: householdUsers.householdId })
      .from(householdUsers)
      .where(eq(householdUsers.userId, userId))
      .for("update");

    if (!current) throw new Error("Account has no household");
    if (current.householdId === householdId) return { refused: "already-member" };

    const members = await tx
      .select({ userId: householdUsers.userId })
      .from(householdUsers)
      .where(eq(householdUsers.householdId, current.householdId));

    if (members.length > 1) return { refused: "shared" };
    if (await holdsAnything(tx, userId)) return { refused: "holds-things" };

    await tx.delete(households).where(eq(households.id, current.householdId));

    const [row] = await tx.insert(householdUsers).values({ householdId, userId }).returning();

    return {
      joined: HouseholdUserSelectBaseSchema.parse(row),
      leftHouseholdId: current.householdId,
    };
  });
}

export async function findHouseholdByJoinCode(code: string): Promise<HouseholdDto | null> {
  const rows = await db.select().from(households).where(eq(households.joinCode, code)).limit(1);
  const parsed = HouseholdSelectBaseSchema.safeParse(rows[0]);

  return parsed.success ? parsed.data : null;
}

/**
 * Regenerates the join code for a household with a new 10-minute expiration
 */
export async function regenerateJoinCode(
  householdId: string,
  version?: number
): Promise<MutationOutcome<HouseholdDto>> {
  const code = await generateUniqueJoinCode();
  const expiresAt = new Date(Date.now() + JOIN_CODE_LIFETIME_MS);

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
): Promise<MutationOutcome<HouseholdDto>> {
  // Verify admin
  const isAdmin = await isUserHouseholdAdmin(householdId, adminUserId);

  if (!isAdmin) {
    throw new Error("Only the household admin can kick members");
  }

  // Cannot kick yourself
  if (userIdToKick === adminUserId) {
    throw new Error("Admin cannot kick themselves. Transfer admin first or leave the household.");
  }

  return await moveToHouseholdOfOne(householdId, userIdToKick, version);
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

export async function renameHousehold(householdId: string, name: string): Promise<void> {
  await db
    .update(households)
    .set({ name: name.trim(), updatedAt: new Date(), version: sql`${households.version} + 1` })
    .where(eq(households.id, householdId));
}

async function generateUniqueJoinCode(): Promise<string> {
  while (true) {
    const code = randomInt(1_000_000).toString().padStart(6, "0");

    const existing = await db
      .select({ id: households.id })
      .from(households)
      .where(eq(households.joinCode, code))
      .limit(1);

    if (existing.length === 0) return code;
  }
}
