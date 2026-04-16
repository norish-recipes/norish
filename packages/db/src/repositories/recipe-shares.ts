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
import { hashToken, safeDecrypt } from "@norish/auth/crypto";
import { db } from "@norish/db/drizzle";
import { users } from "@norish/db/schema/auth";
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
  mapRecipeToPublicRecipeView,
  resolveRecipeShareExpiresAt,
  toRecipeShareSummary,
} from "./recipe-share-helpers";
import { getRecipeFull } from "./recipes";

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

export async function getAllRecipeShares(): Promise<RecipeShareSummaryDto[]> {
  const rows = await db.select().from(recipeShares).orderBy(desc(recipeShares.createdAt));

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
    .where(eq(recipeShares.userId, userId))
    .orderBy(desc(recipeShares.createdAt));

  return rows.map(({ share, recipeName }) =>
    RecipeShareInventorySchema.parse({
      ...toRecipeShareSummary(RecipeShareSelectSchema.parse(share)),
      recipeName,
    })
  );
}

export async function getRecipeShareInventoryForAdmin(): Promise<AdminRecipeShareInventoryDto[]> {
  const rows = await db
    .select({
      share: recipeShares,
      recipeName: recipes.name,
      ownerId: users.id,
      ownerName: users.name,
    })
    .from(recipeShares)
    .innerJoin(recipes, eq(recipeShares.recipeId, recipes.id))
    .innerJoin(users, eq(recipeShares.userId, users.id))
    .orderBy(desc(recipeShares.createdAt));

  return rows.map(({ share, recipeName, ownerId, ownerName }) =>
    AdminRecipeShareInventorySchema.parse({
      ...toRecipeShareSummary(RecipeShareSelectSchema.parse(share)),
      recipeName,
      ownerId,
      ownerName: safeDecrypt(ownerName),
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

  if (!options.touchLastAccessedAt) {
    return share;
  }

  return touchRecipeShareLastAccessed(share);
}

export async function getPublicRecipeView(
  recipeId: string,
  shareToken: string
): Promise<PublicRecipeViewDTO | null> {
  const recipe = await getRecipeFull(recipeId);

  if (!recipe) {
    return null;
  }

  return mapRecipeToPublicRecipeView(recipe, shareToken);
}

export { getRecipeShareStatus, mapRecipeToPublicRecipeView, resolveRecipeShareExpiresAt };
