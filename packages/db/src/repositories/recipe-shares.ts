import crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";

import type {
  AdminRecipeShareInventoryDto,
  CreateRecipeShareInputDto,
  PublicRecipeViewDTO,
  RecipeShareCreatedDto,
  RecipeShareDto,
  RecipeShareInventoryDto,
  RecipeShareSummaryDto,
  UpdateRecipeShareInputDto,
} from "@norish/shared/contracts/dto/recipe-shares";
import { decrypt, encrypt, hashToken, safeDecrypt } from "@norish/config/crypto";
import { policyAllows } from "@norish/config/zod/server-config";
import { db } from "@norish/db/drizzle";
import { users } from "@norish/db/schema/auth";
import { householdUsers } from "@norish/db/schema/household-users";
import { recipeShares } from "@norish/db/schema/recipe-shares";
import { recipes } from "@norish/db/schema/recipes";
import {
  AdminRecipeShareInventorySchema,
  CreateRecipeShareInputSchema,
  RecipeShareCreatedSchema,
  RecipeShareInventorySchema,
  RecipeShareSelectSchema,
  UpdateRecipeShareInputSchema,
} from "@norish/shared/contracts/zod/recipe-shares";

import type { MutationOutcome } from "./mutation-outcomes";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import {
  getRecipeShareStatus,
  hasKeptLink,
  mapRecipeToPublicRecipeView,
  resolveRecipeShareExpiresAt,
  toRecipeShareSummary,
} from "./recipe-share-helpers";
import { accountCanViewRecipe, accountViewCondition, getRecipeFull } from "./recipes";
import { getRecipePermissionPolicy } from "./server-config";

type ActiveShareOptions = {
  touchLastAccessedAt?: boolean;
};

async function touchRecipeShareLastAccessed(share: RecipeShareDto): Promise<RecipeShareDto> {
  const [updated] = await db
    .update(recipeShares)
    .set({
      lastAccessedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${recipeShares.version} + 1`,
    })
    .where(and(eq(recipeShares.id, share.id), eq(recipeShares.version, share.version)))
    .returning();

  if (updated) {
    return RecipeShareSelectSchema.parse(updated);
  }

  const latest = await getRecipeShareById(share.id);

  return latest ?? share;
}

export async function createRecipeShare(
  userId: string,
  input: CreateRecipeShareInputDto
): Promise<RecipeShareCreatedDto> {
  const validated = CreateRecipeShareInputSchema.parse(input);
  const token = crypto.randomBytes(24).toString("base64url");

  const [row] = await db
    .insert(recipeShares)
    .values({
      userId,
      recipeId: validated.recipeId,
      tokenHash: hashToken(token),
      tokenEnc: encrypt(token),
      expiresAt: resolveRecipeShareExpiresAt(validated.expiresIn),
    })
    .returning();

  const share = RecipeShareSelectSchema.parse(row);

  return RecipeShareCreatedSchema.parse({
    ...toRecipeShareSummary(share),
    url: `/share/${token}`,
  });
}

export async function getRecipeShareById(id: string): Promise<RecipeShareDto | null> {
  const [row] = await db.select().from(recipeShares).where(eq(recipeShares.id, id)).limit(1);

  if (!row) {
    return null;
  }

  return RecipeShareSelectSchema.parse(row);
}

/** The share's link while it is active, or null; a share with no stored token has no link. */
export function getRecipeShareUrl(share: RecipeShareDto): string | null {
  if (!hasKeptLink(share) || getRecipeShareStatus(share) !== "active") return null;

  try {
    return `/share/${decrypt(share.tokenEnc)}`;
  } catch {
    // An unreadable token (say, a changed key) answers no link and logs nothing.
    return null;
  }
}

export async function getRecipeShareByToken(token: string): Promise<RecipeShareDto | null> {
  const [row] = await db
    .select()
    .from(recipeShares)
    .where(eq(recipeShares.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) {
    return null;
  }

  return RecipeShareSelectSchema.parse(row);
}

export async function getRecipeSharesByUserId(
  userId: string,
  recipeId?: string
): Promise<RecipeShareSummaryDto[]> {
  const whereConditions = [eq(recipeShares.userId, userId)];

  if (recipeId) {
    whereConditions.push(eq(recipeShares.recipeId, recipeId));
  }

  const rows = await db
    .select()
    .from(recipeShares)
    .where(and(...whereConditions))
    .orderBy(desc(recipeShares.createdAt));

  return rows.map((row) => toRecipeShareSummary(RecipeShareSelectSchema.parse(row)));
}

export async function getRecipeShareInventoryByUserId(
  userId: string
): Promise<RecipeShareInventoryDto[]> {
  const rows = await db
    .select({
      share: recipeShares,
      recipeName: recipes.name,
    })
    .from(recipeShares)
    .innerJoin(recipes, eq(recipeShares.recipeId, recipes.id))
    // A recipe the maker may no longer view is left out until they may again.
    .where(
      and(eq(recipeShares.userId, userId), await accountViewCondition(userId, recipes.householdId))
    )
    .orderBy(desc(recipeShares.createdAt));

  return rows.map(({ share, recipeName }) =>
    RecipeShareInventorySchema.parse({
      ...toRecipeShareSummary(RecipeShareSelectSchema.parse(share)),
      recipeName,
    })
  );
}

/** Every account's share links, for admin moderation across households. */
export async function getRecipeShareInventoryForAdmin(): Promise<AdminRecipeShareInventoryDto[]> {
  const [policy, rows] = await Promise.all([
    getRecipePermissionPolicy(),
    db
      .select({
        share: recipeShares,
        recipeName: recipes.name,
        recipeHouseholdId: recipes.householdId,
        ownerId: users.id,
        ownerName: users.name,
        makerHouseholdId: householdUsers.householdId,
      })
      .from(recipeShares)
      .innerJoin(recipes, eq(recipeShares.recipeId, recipes.id))
      .innerJoin(users, eq(recipeShares.userId, users.id))
      .leftJoin(householdUsers, eq(householdUsers.userId, recipeShares.userId))
      .orderBy(desc(recipeShares.createdAt)),
  ]);

  return rows.map(
    ({ share, recipeName, recipeHouseholdId, ownerId, ownerName, makerHouseholdId }) =>
      AdminRecipeShareInventorySchema.parse({
        ...toRecipeShareSummary(RecipeShareSelectSchema.parse(share)),
        recipeName,
        ownerId,
        ownerName: safeDecrypt(ownerName),
        // The same rule as `accountCanViewRecipe`, read once for the whole list.
        makerMayView:
          makerHouseholdId !== null &&
          policyAllows(policy, "view", makerHouseholdId, recipeHouseholdId),
      })
  );
}

export async function updateRecipeShare(
  input: UpdateRecipeShareInputDto
): Promise<MutationOutcome<RecipeShareSummaryDto>> {
  const validated = UpdateRecipeShareInputSchema.parse(input);

  const [row] = await db
    .update(recipeShares)
    .set({
      expiresAt: resolveRecipeShareExpiresAt(validated.expiresIn),
      updatedAt: new Date(),
      version: sql`${recipeShares.version} + 1`,
    })
    .where(and(eq(recipeShares.id, validated.id), eq(recipeShares.version, validated.version)))
    .returning();

  if (!row) {
    return staleOutcome();
  }

  return appliedOutcome(toRecipeShareSummary(RecipeShareSelectSchema.parse(row)));
}

export async function revokeRecipeShare(
  id: string,
  version: number
): Promise<MutationOutcome<RecipeShareSummaryDto>> {
  const [row] = await db
    .update(recipeShares)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${recipeShares.version} + 1`,
    })
    .where(and(eq(recipeShares.id, id), eq(recipeShares.version, version)))
    .returning();

  if (!row) {
    return staleOutcome();
  }

  return appliedOutcome(toRecipeShareSummary(RecipeShareSelectSchema.parse(row)));
}

export async function reactivateRecipeShare(
  id: string,
  version: number
): Promise<MutationOutcome<RecipeShareSummaryDto>> {
  const [row] = await db
    .update(recipeShares)
    .set({
      revokedAt: null,
      updatedAt: new Date(),
      version: sql`${recipeShares.version} + 1`,
    })
    .where(and(eq(recipeShares.id, id), eq(recipeShares.version, version)))
    .returning();

  if (!row) {
    return staleOutcome();
  }

  return appliedOutcome(toRecipeShareSummary(RecipeShareSelectSchema.parse(row)));
}

export async function deleteRecipeShare(
  id: string,
  version: number
): Promise<MutationOutcome<void>> {
  const deleted = await db
    .delete(recipeShares)
    .where(and(eq(recipeShares.id, id), eq(recipeShares.version, version)))
    .returning({ id: recipeShares.id });

  if (deleted.length === 0) {
    return staleOutcome();
  }

  return appliedOutcome(undefined);
}

export async function getActiveRecipeShareByToken(
  token: string,
  options: ActiveShareOptions = {}
): Promise<RecipeShareDto | null> {
  const share = await getRecipeShareByToken(token);

  if (!share || getRecipeShareStatus(share) !== "active") {
    return null;
  }

  // Inactive while its maker may not view the recipe; it works again once they may.
  if (!(await accountCanViewRecipe(share.userId, share.recipeId))) return null;

  if (!options.touchLastAccessedAt) {
    return share;
  }

  return touchRecipeShareLastAccessed(share);
}

/**
 * A shared recipe's public view, with each line's Ingredient Icon read by
 * `iconsFor` (which icon a food shows is the ingredient module's to say).
 */
export async function getPublicRecipeView(
  recipeId: string,
  shareToken: string,
  iconsFor: (ingredientIds: string[]) => Promise<ReadonlyMap<string, string | null>>
): Promise<PublicRecipeViewDTO | null> {
  const recipe = await getRecipeFull(recipeId);

  if (!recipe) {
    return null;
  }

  const icons = await iconsFor(
    recipe.recipeIngredients.flatMap((line) => (line.ingredientId ? [line.ingredientId] : []))
  );

  return mapRecipeToPublicRecipeView(recipe, shareToken, icons);
}

export {
  getRecipeShareStatus,
  hasKeptLink,
  mapRecipeToPublicRecipeView,
  resolveRecipeShareExpiresAt,
  toRecipeShareSummary,
};
