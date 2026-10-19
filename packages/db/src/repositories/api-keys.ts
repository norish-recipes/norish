import { and, eq } from "drizzle-orm";

import type { ApiKeyAuthService } from "@norish/shared/contracts/dto/auth";
import { db } from "@norish/db/drizzle";
import { apiKeys } from "@norish/db/schema/auth";

let apiKeyAuthService: ApiKeyAuthService | null = null;

export function setApiKeyAuthService(service: ApiKeyAuthService): void {
  apiKeyAuthService = service;
}

function requireApiKeyAuthService(): ApiKeyAuthService {
  if (!apiKeyAuthService) {
    throw new Error("API key auth service not configured");
  }

  return apiKeyAuthService;
}

export type ApiKeyMetadata = {
  id: string;
  name: string | null;
  start: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  enabled: boolean | null;
};

/**
 * Create a new API key for a user using BetterAuth's apiKey plugin
 */
export async function createApiKey(
  userId: string,
  name?: string
): Promise<{ key: string; metadata: ApiKeyMetadata }> {
  const authService = requireApiKeyAuthService();

  // Use BetterAuth's API to create the key
  const result = await authService.createApiKey({
    body: {
      name: name || "Default API Key",
      expiresIn: null, // No expiration by default
      userId,
    },
  });

  return {
    key: result.key,
    metadata: {
      id: result.id,
      name: result.name,
      start: result.start,
      createdAt: result.createdAt,
      expiresAt: result.expiresAt,
      enabled: result.enabled,
    },
  };
}

export type ApiKeyVerification =
  | { status: "valid"; userId: string }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "invalid" };

export function isApiKeyAuthServiceConfigured(): boolean {
  return apiKeyAuthService !== null;
}

export async function verifyApiKeyForRequest(key: string): Promise<ApiKeyVerification> {
  try {
    const authService = requireApiKeyAuthService();
    const result = await authService.verifyApiKey({
      body: { key },
    });

    if (result.valid && result.key) {
      return { status: "valid", userId: result.key.referenceId };
    }

    if (result.error?.code === "RATE_LIMITED") {
      const retryAfterMs = result.error.details?.tryAgainIn ?? 60_000;

      return {
        status: "rate_limited",
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    return { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}

export async function verifyApiKey(key: string): Promise<string | null> {
  const result = await verifyApiKeyForRequest(key);

  return result.status === "valid" ? result.userId : null;
}

/**
 * Get active API keys for a user
 */
export async function getApiKeysForUser(userId: string): Promise<ApiKeyMetadata[]> {
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      start: apiKeys.start,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
      enabled: apiKeys.enabled,
    })
    .from(apiKeys)
    .where(eq(apiKeys.referenceId, userId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    start: row.start,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    enabled: row.enabled,
  }));
}

/**
 * Delete/revoke an API key
 */
export async function deleteApiKey(keyId: string, userId: string): Promise<void> {
  await db.delete(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.referenceId, userId)));
}

/**
 * Disable an API key (soft revoke)
 */
export async function disableApiKey(keyId: string, userId: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ enabled: false })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.referenceId, userId)));
}

/**
 * Enable a disabled API key
 */
export async function enableApiKey(keyId: string, userId: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ enabled: true })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.referenceId, userId)));
}
