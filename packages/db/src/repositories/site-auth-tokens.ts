import { and, eq, sql } from "drizzle-orm";

import type {
  CreateSiteAuthTokenInputDto,
  SiteAuthTokenDecryptedDto,
  SiteAuthTokenDto,
  SiteAuthTokenSafeDto,
  UpdateSiteAuthTokenInputDto,
} from "@norish/shared/contracts/dto/site-auth-tokens";
import { decrypt, encrypt } from "@norish/auth/crypto";
import { db } from "@norish/db/drizzle";
import { siteAuthTokens } from "@norish/db/schema";
import {
  CreateSiteAuthTokenInputSchema,
  SiteAuthTokenSelectSchema,
  UpdateSiteAuthTokenInputSchema,
} from "@norish/shared/contracts/zod/site-auth-tokens";

import type { MutationOutcome } from "./mutation-outcomes";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";

function decryptToken(token: SiteAuthTokenDto): SiteAuthTokenDecryptedDto {
  return {
    id: token.id,
    userId: token.userId,
    domain: token.domain,
    name: token.name,
    value: decrypt(token.valueEnc),
    type: token.type,
    version: token.version,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
  };
}

function toSafeToken(token: SiteAuthTokenDto): SiteAuthTokenSafeDto {
  return {
    id: token.id,
    userId: token.userId,
    domain: token.domain,
    name: token.name,
    type: token.type,
    version: token.version,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
  };
}

export async function createSiteAuthToken(
  userId: string,
  input: CreateSiteAuthTokenInputDto
): Promise<SiteAuthTokenSafeDto> {
  const validated = CreateSiteAuthTokenInputSchema.parse(input);

  const [row] = await db
    .insert(siteAuthTokens)
    .values({
      userId,
      domain: validated.domain,
      name: validated.name,
      valueEnc: encrypt(validated.value),
      type: validated.type,
    })
    .returning();

  const parsed = SiteAuthTokenSelectSchema.parse(row);

  return toSafeToken(parsed);
}

export async function getTokensByUserId(userId: string): Promise<SiteAuthTokenSafeDto[]> {
  const rows = await db.select().from(siteAuthTokens).where(eq(siteAuthTokens.userId, userId));

  return rows.map((row) => {
    const parsed = SiteAuthTokenSelectSchema.parse(row);

    return toSafeToken(parsed);
  });
}

export async function getTokensByUserAndDomain(
  userId: string,
  domain: string
): Promise<SiteAuthTokenDecryptedDto[]> {
  const rows = await db
    .select()
    .from(siteAuthTokens)
    .where(and(eq(siteAuthTokens.userId, userId), eq(siteAuthTokens.domain, domain)));

  return rows.map((row) => {
    const parsed = SiteAuthTokenSelectSchema.parse(row);

    return decryptToken(parsed);
  });
}

export async function getDecryptedTokensByUserId(
  userId: string
): Promise<SiteAuthTokenDecryptedDto[]> {
  const rows = await db.select().from(siteAuthTokens).where(eq(siteAuthTokens.userId, userId));

  return rows.map((row) => {
    const parsed = SiteAuthTokenSelectSchema.parse(row);

    return decryptToken(parsed);
  });
}

export async function getTokenById(
  userId: string,
  tokenId: string
): Promise<SiteAuthTokenSafeDto | null> {
  const rows = await db
    .select()
    .from(siteAuthTokens)
    .where(and(eq(siteAuthTokens.id, tokenId), eq(siteAuthTokens.userId, userId)))
    .limit(1);

  const row = rows[0];

  if (!row) return null;

  const parsed = SiteAuthTokenSelectSchema.parse(row);

  return toSafeToken(parsed);
}

export async function updateSiteAuthToken(
  userId: string,
  input: UpdateSiteAuthTokenInputDto
): Promise<MutationOutcome<SiteAuthTokenSafeDto>> {
  const validated = UpdateSiteAuthTokenInputSchema.parse(input);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (validated.domain !== undefined) updateData.domain = validated.domain;
  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.value !== undefined) updateData.valueEnc = encrypt(validated.value);
  if (validated.type !== undefined) updateData.type = validated.type;

  const whereConditions = [eq(siteAuthTokens.id, validated.id), eq(siteAuthTokens.userId, userId)];

  if (validated.version) {
    whereConditions.push(eq(siteAuthTokens.version, validated.version));
  }

  const [row] = await db
    .update(siteAuthTokens)
    .set({ ...updateData, version: sql`${siteAuthTokens.version} + 1` })
    .where(and(...whereConditions))
    .returning();

  if (!row) return staleOutcome();

  const parsed = SiteAuthTokenSelectSchema.parse(row);

  return appliedOutcome(toSafeToken(parsed));
}

export async function deleteSiteAuthToken(
  userId: string,
  tokenId: string,
  version: number
): Promise<MutationOutcome<void>> {
  const whereConditions = [eq(siteAuthTokens.id, tokenId), eq(siteAuthTokens.userId, userId)];

  if (version) {
    whereConditions.push(eq(siteAuthTokens.version, version));
  }

  const result = await db
    .delete(siteAuthTokens)
    .where(and(...whereConditions))
    .returning({ id: siteAuthTokens.id });

  if (result.length === 0) return staleOutcome();

  return appliedOutcome(undefined);
}
