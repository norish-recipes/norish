import { randomInt } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { and, eq, inArray, sql } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import type {
  HouseholdDto,
  HouseholdUserDto,
  HouseholdWithUsersNamesDto,
} from "@norish/shared/contracts/dto/household";
import type { JoinRefusal } from "@norish/shared/lib/join-refusals";
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
  users,
} from "@norish/db/schema";
import {
  HouseholdSelectBaseSchema,
  HouseholdUserSelectBaseSchema,
  HouseholdWithUsersNamesSchema,
} from "@norish/shared/contracts/zod/household";

import type { MutationOutcome } from "./mutation-outcomes";
import { isRetryableConflict } from "./constraint-violation";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { turnPlannedRecipesIntoNotes } from "./planned-items";
import { getUsersByIds } from "./users";

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

async function insertHouseholdOfOne(tx: DbTransaction, userId: string): Promise<HouseholdDto> {
  // No join code, as sign-up makes one: generating it here would query the pool under the lock.
  const [row] = await tx
    .insert(households)
    .values({ name: NEW_HOUSEHOLD_NAME, adminUserId: userId })
    .returning();

  await tx.insert(householdUsers).values({ householdId: row!.id, userId });

  return HouseholdSelectBaseSchema.parse(row);
}

/** Locks the households in id order, so two moves never wait on each other in a cycle. */
async function lockHouseholds(tx: DbTransaction, ids: string[]) {
  return await tx
    .select({
      id: households.id,
      name: households.name,
      adminUserId: households.adminUserId,
      joinCode: households.joinCode,
      joinCodeExpiresAt: households.joinCodeExpiresAt,
    })
    .from(households)
    .where(inArray(households.id, ids))
    .orderBy(households.id)
    .for("update");
}

/** The account left the household it was read in before that household's lock landed. */
const MOVED = Symbol("moved");

/** How many fresh transactions an operation tries on an account that keeps moving. */
export const MOVED_ATTEMPTS = 3;

/** How many times a locked membership write runs again after losing a deadlock to a household write. */
const DEADLOCK_ATTEMPTS = 3;
const DEADLOCK_BACKOFF_MS = 50;

/** One transaction of a locked membership write, run afresh while Postgres picks it as a deadlock's victim. */
async function lockedTransaction<T>(work: (tx: DbTransaction) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction(work);
    } catch (error) {
      if (attempt >= DEADLOCK_ATTEMPTS || !isRetryableConflict(error)) throw error;
      // Retried at once, it can take the household back before the winner and deadlock again.
      await sleep(DEADLOCK_BACKOFF_MS * attempt);
    }
  }
}

/** Runs `work` in a fresh transaction while it finds the account MOVED, then gives `givenUp`. */
async function retryWhileMoved<T, G>(
  givenUp: G,
  work: (tx: DbTransaction) => Promise<T | typeof MOVED>
): Promise<T | G> {
  for (let attempt = 0; attempt < MOVED_ATTEMPTS; attempt++) {
    const result = await lockedTransaction(work);

    if (result !== MOVED) return result;
  }

  return givenUp;
}

/** Locks the account's household; every move of the account locks it first, so it stays put. */
async function lockHouseholdOf(tx: DbTransaction, userId: string) {
  const current = await householdIdIn(tx, userId);

  if (!current) return null;

  const [household] = await lockHouseholds(tx, [current]);

  return household && (await householdIdIn(tx, userId)) === current ? household : MOVED;
}

/** Longest-standing first. */
async function memberIdsIn(tx: DbTransaction, householdId: string): Promise<string[]> {
  const rows = await tx
    .select({ userId: householdUsers.userId })
    .from(householdUsers)
    .where(eq(householdUsers.householdId, householdId))
    .orderBy(householdUsers.createdAt, householdUsers.userId);

  return rows.map((row) => row.userId);
}

export type MovedOutcome = MutationOutcome<{ household: HouseholdDto; memberIds: string[] }>;

/**
 * Takes a member out of a household and into a new household of one, in one transaction
 * under the household's lock. `memberIds` are who stays. Pass `removedBy` for the admin's removal.
 */
export async function moveToHouseholdOfOne(
  householdId: string,
  userId: string,
  version?: number,
  removedBy?: string
): Promise<MovedOutcome> {
  return await lockedTransaction(async (tx) => {
    const [household] = await lockHouseholds(tx, [householdId]);

    if (!household) return staleOutcome();
    if (removedBy !== undefined && household.adminUserId !== removedBy) {
      throw new Error("Only the household admin can kick members");
    }
    if (household.adminUserId === userId) {
      throw new Error("The household admin hands the role on before leaving");
    }
    const memberIds = (await memberIdsIn(tx, householdId)).filter((id) => id !== userId);

    if (memberIds.length === 0) {
      throw new Error("The last member cannot leave their household");
    }

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

    return appliedOutcome({ household: await insertHouseholdOfOne(tx, userId), memberIds });
  });
}

/** What a household of one holds, under its member's id or its own, which joining cannot merge yet. */
const HELD_BY_MEMBER: ReadonlyArray<readonly [PgTable, AnyPgColumn]> = [
  [recipes, recipes.userId],
  [cookbooks, cookbooks.userId],
  [ingredients, ingredients.ownerId],
  [ingredientAliases, ingredientAliases.ownerId],
];

const HELD_BY_HOUSEHOLD: ReadonlyArray<readonly [PgTable, AnyPgColumn]> = [
  [stores, stores.householdId],
  [ingredientStorePreferences, ingredientStorePreferences.householdId],
  [groceries, groceries.householdId],
  [recurringGroceries, recurringGroceries.householdId],
  [pantryIngredients, pantryIngredients.householdId],
  [plannedItems, plannedItems.householdId],
  [ingredientNutritionCorrections, ingredientNutritionCorrections.householdId],
];

async function holdsAnything(
  tx: DbTransaction,
  userId: string,
  householdId: string
): Promise<boolean> {
  const held = [
    ...HELD_BY_MEMBER.map(([table, column]) => [table, eq(column, userId)] as const),
    ...HELD_BY_HOUSEHOLD.map(([table, column]) => [table, eq(column, householdId)] as const),
  ];

  for (const [table, where] of held) {
    const rows = await tx
      .select({ one: sql`1` })
      .from(table)
      .where(where)
      .limit(1);

    if (rows.length > 0) return true;
  }

  return false;
}

export type JoinHouseholdOutcome =
  | { joined: HouseholdUserDto; leftHouseholdId: string; memberIds: string[] }
  | { refused: JoinRefusal };

/**
 * Moves an account into another household, deleting the household of one it leaves;
 * with `name`, only while the household still carries it (case aside). Refused from a
 * shared household (leave first) and, until merging lands (ticket 09), from a household
 * of one that holds anything. `memberIds` are the members it joined.
 */
export async function joinHousehold(
  userId: string,
  target: { householdId: string; name?: string } | { joinCode: string }
): Promise<JoinHouseholdOutcome> {
  return await retryWhileMoved({ refused: "shared" } as const, async (tx) => {
    const current = await householdIdIn(tx, userId);

    if (!current) throw new Error("Account has no household");

    const householdId =
      "householdId" in target ? target.householdId : await householdIdForCode(tx, target.joinCode);

    if (!householdId) return { refused: "gone" };
    if (current === householdId) return { refused: "already-member" };

    const locked = await lockHouseholds(tx, [current, householdId]);
    const household = locked.find((h) => h.id === householdId);

    if (!household) return { refused: "gone" };
    // Read again under the lock, so a code rotated or expired, or a rename, admits nobody.
    if ("name" in target && target.name !== undefined) {
      const [named] = await tx
        .select({ id: households.id })
        .from(households)
        .where(and(eq(households.id, householdId), householdNamed(target.name)));

      if (!named) return { refused: "gone" };
    }
    if ("joinCode" in target) {
      if (household.joinCode !== target.joinCode) return { refused: "gone" };
      if (household.joinCodeExpiresAt && household.joinCodeExpiresAt < new Date()) {
        return { refused: "expired" };
      }
    }
    // Every move of this account locks its household first, so this read is now stable.
    if ((await householdIdIn(tx, userId)) !== current) return MOVED;
    if ((await memberIdsIn(tx, current)).length > 1) return { refused: "shared" };
    if (await holdsAnything(tx, userId, current)) return { refused: "holds-things" };

    const memberIds = await memberIdsIn(tx, householdId);

    await tx.delete(households).where(eq(households.id, current));

    const [row] = await tx.insert(householdUsers).values({ householdId, userId }).returning();

    return {
      joined: HouseholdUserSelectBaseSchema.parse(row),
      leftHouseholdId: current,
      memberIds,
    };
  });
}

async function householdIdForCode(tx: DbTransaction, code: string): Promise<string | null> {
  const [row] = await tx
    .select({ id: households.id })
    .from(households)
    .where(eq(households.joinCode, code));

  return row?.id ?? null;
}

async function householdIdIn(tx: DbTransaction, userId: string): Promise<string | null> {
  const [row] = await tx
    .select({ householdId: householdUsers.householdId })
    .from(householdUsers)
    .where(eq(householdUsers.userId, userId));

  return row?.householdId ?? null;
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

/** The admin removes a member, who lands in a new household of one. */
export async function kickUserFromHousehold(
  householdId: string,
  userIdToKick: string,
  adminUserId: string,
  version?: number
): Promise<MovedOutcome> {
  return await moveToHouseholdOfOne(householdId, userIdToKick, version, adminUserId);
}

/** Hands the admin role to another member, checked under the household's lock. */
export async function transferHouseholdAdmin(
  householdId: string,
  currentAdminId: string,
  newAdminId: string,
  version?: number
): Promise<MutationOutcome<HouseholdDto>> {
  return await lockedTransaction(async (tx) => {
    const [household] = await lockHouseholds(tx, [householdId]);

    if (household?.adminUserId !== currentAdminId) {
      throw new Error("Only the current admin can transfer admin privileges");
    }
    if (!(await memberIdsIn(tx, householdId)).includes(newAdminId)) {
      throw new Error("New admin must be a member of the household");
    }

    const whereConditions = [eq(households.id, householdId)];

    if (version) {
      whereConditions.push(eq(households.version, version));
    }

    const [row] = await tx
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
  });
}

/** The household carries `name`, case and outer space aside; the lookup and the join share it. */
const householdNamed = (name: string) =>
  sql`LOWER(${households.name}) = ${name.toLowerCase().trim()}`;

/**
 * Find a household by name (case-insensitive)
 */
export async function findHouseholdByName(name: string): Promise<HouseholdDto | null> {
  const rows = await db.select().from(households).where(householdNamed(name)).limit(1);

  const parsed = HouseholdSelectBaseSchema.safeParse(rows[0]);

  return parsed.success ? parsed.data : null;
}

/** Names the account's household while it is a household of one; null once it is shared. */
export async function renameHouseholdOfOne(userId: string, name: string): Promise<string | null> {
  return await retryWhileMoved(null, async (tx) => {
    const household = await lockHouseholdOf(tx, userId);

    if (household === MOVED) return MOVED;
    if (!household || (await memberIdsIn(tx, household.id)).length > 1) return null;

    await tx
      .update(households)
      .set({ name: name.trim(), updatedAt: new Date(), version: sql`${households.version} + 1` })
      .where(eq(households.id, household.id));

    return household.id;
  });
}

/** What one account deletion did, for the work that runs once it committed. */
export interface AccountDeletion {
  /** The household the account was in; null for an account already gone. */
  householdId: string | null;
  householdErased: boolean;
  successorId: string | null;
  /** Who stays in the household, longest-standing first. */
  memberIds: string[];
  /** The erased recipes and cookbooks, whose files are swept after the commit. */
  recipeIds: string[];
  cookbookIds: string[];
  /** The plan entries for those recipes that became notes, in households that stay. */
  notes: Array<typeof plannedItems.$inferSelect>;
}

/**
 * Deletes an account under its household's lock: the admin role passes to the longest-standing
 * member, or the household goes with its last member. The account's recipes and cookbooks cascade
 * away, and every plan entry for one of those recipes becomes a note first.
 */
export async function deleteAccount(userId: string): Promise<AccountDeletion> {
  const deletion = await retryWhileMoved(MOVED, async (tx) => {
    const household = await lockHouseholdOf(tx, userId);

    if (household === MOVED) return MOVED;
    const others = household
      ? (await memberIdsIn(tx, household.id)).filter((id) => id !== userId)
      : [];
    const successorId = household?.adminUserId === userId ? (others[0] ?? null) : null;
    const erased = household && others.length === 0 ? household.id : null;
    // Content rows after the household's: locked, so no household plans one of them meanwhile.
    const recipeIds = (
      await tx
        .select({ id: recipes.id })
        .from(recipes)
        .where(eq(recipes.userId, userId))
        .for("update")
    ).map((row) => row.id);
    const cookbookIds = (
      await tx.select({ id: cookbooks.id }).from(cookbooks).where(eq(cookbooks.userId, userId))
    ).map((row) => row.id);
    // An erased household's own plan goes with it, so only the others' entries become notes.
    const notes = await turnPlannedRecipesIntoNotes(tx, recipeIds, erased);

    if (erased) {
      await tx.delete(households).where(eq(households.id, erased));
    } else if (household && successorId) {
      await tx
        .update(households)
        .set({
          adminUserId: successorId,
          updatedAt: new Date(),
          version: sql`${households.version} + 1`,
        })
        .where(eq(households.id, household.id));
    }

    await tx.delete(users).where(eq(users.id, userId));

    return {
      householdId: household?.id ?? null,
      householdErased: erased !== null,
      successorId,
      memberIds: others,
      recipeIds,
      cookbookIds,
      notes,
    };
  });

  if (deletion === MOVED) throw new Error("The account kept moving while being deleted");

  return deletion;
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
