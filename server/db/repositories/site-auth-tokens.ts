import type {
  SiteAuthTokenDto,
  SiteAuthTokenDecryptedDto,
  SiteAuthTokenSafeDto,
  CreateSiteAuthTokenInputDto,
  UpdateSiteAuthTokenInputDto,
} from "@/types/dto/site-auth-tokens";

import { eq, and } from "drizzle-orm";

import { db } from "@/server/db/drizzle";
import { siteAuthTokens } from "@/server/db/schema";
import { encrypt, decrypt } from "@/server/auth/crypto";
import {
  SiteAuthTokenSelectSchema,
  CreateSiteAuthTokenInputSchema,
  UpdateSiteAuthTokenInputSchema,
} from "@/server/db/zodSchemas/site-auth-tokens";

function decryptToken(token: SiteAuthTokenDto): SiteAuthTokenDecryptedDto {
  return {
    id: token.id,
    userId: token.userId,
    domain: token.domain,
    name: token.name,
    value: decrypt(token.valueEnc),
    type: token.type,
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
): Promise<SiteAuthTokenSafeDto> {
  const validated = UpdateSiteAuthTokenInputSchema.parse(input);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (validated.domain !== undefined) updateData.domain = validated.domain;
  if (validated.name !== undefined) updateData.name = validated.name;
  if (validated.value !== undefined) updateData.valueEnc = encrypt(validated.value);
  if (validated.type !== undefined) updateData.type = validated.type;

  const [row] = await db
    .update(siteAuthTokens)
    .set(updateData)
    .where(and(eq(siteAuthTokens.id, validated.id), eq(siteAuthTokens.userId, userId)))
    .returning();

  if (!row) throw new Error("Token not found or access denied");

  const parsed = SiteAuthTokenSelectSchema.parse(row);

  return toSafeToken(parsed);
}

export async function deleteSiteAuthToken(userId: string, tokenId: string): Promise<void> {
  const result = await db
    .delete(siteAuthTokens)
    .where(and(eq(siteAuthTokens.id, tokenId), eq(siteAuthTokens.userId, userId)))
    .returning({ id: siteAuthTokens.id });

  if (result.length === 0) throw new Error("Token not found or access denied");
}
