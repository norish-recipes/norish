import { eq, sql } from "drizzle-orm";

import { decrypt, encrypt } from "@norish/auth/crypto";
import { dbLogger } from "@norish/db/logger";

import type { ServerConfigKey, ServerConfigMetadata } from "../zodSchemas/server-config";
import { db } from "../drizzle";
import { serverConfig } from "../schema/server-config";
import {
  normalizeConfigValue,
  SENSITIVE_CONFIG_KEYS,
  validateConfigValue,
} from "../zodSchemas/server-config";

export async function getConfig<T = unknown>(
  key: ServerConfigKey,
  includeSecrets = false
): Promise<T | null> {
  const config = await db.query.serverConfig.findFirst({
    where: eq(serverConfig.key, key),
  });

  if (!config) {
    return null;
  }

  const raw = getStoredConfigValue(config, includeSecrets, key);

  return (raw?.value as T) ?? null;
}

export async function setConfig(
  key: ServerConfigKey,
  value: unknown,
  userId: string | null,
  isSensitive?: boolean
): Promise<void> {
  const shouldEncrypt = isSensitive ?? SENSITIVE_CONFIG_KEYS.includes(key);

  const validation = validateConfigValue(key, value);

  if (!validation.success) {
    throw new Error(`Invalid config value for ${key}: ${validation.error.message}`);
  }

  const normalizedValue = validation.data;

  const now = new Date();

  const existing = await db.query.serverConfig.findFirst({
    where: eq(serverConfig.key, key),
  });

  if (shouldEncrypt) {
    let finalValue = normalizedValue;

    // If updating an existing sensitive config, preserve unchanged sensitive fields
    if (existing && existing.isSensitive && existing.valueEnc) {
      try {
        const existingDecrypted = JSON.parse(decrypt(existing.valueEnc));

        finalValue = mergeSensitiveFields(existingDecrypted, normalizedValue);
      } catch (error) {
        dbLogger.error({ err: error, key }, "Failed to merge sensitive fields");
      }
    }

    const encryptedValue = encrypt(JSON.stringify(finalValue));
    const maskedValue = maskSensitiveFields(finalValue);

    if (existing) {
      await db
        .update(serverConfig)
        .set({
          value: maskedValue,
          valueEnc: encryptedValue,
          isSensitive: true,
          updatedBy: userId,
          updatedAt: now,
          version: sql`${serverConfig.version} + 1`,
        })
        .where(eq(serverConfig.key, key));
    } else {
      await db.insert(serverConfig).values({
        key,
        value: maskedValue,
        valueEnc: encryptedValue,
        isSensitive: true,
        updatedBy: userId,
        updatedAt: now,
        createdAt: now,
      });
    }
  } else {
    if (existing) {
      await db
        .update(serverConfig)
        .set({
          value: normalizedValue,
          valueEnc: null,
          isSensitive: false,
          updatedBy: userId,
          updatedAt: now,
          version: sql`${serverConfig.version} + 1`,
        })
        .where(eq(serverConfig.key, key));
    } else {
      await db.insert(serverConfig).values({
        key,
        value: normalizedValue,
        valueEnc: null,
        isSensitive: false,
        updatedBy: userId,
        updatedAt: now,
        createdAt: now,
      });
    }
  }
}

export async function deleteConfig(key: ServerConfigKey): Promise<void> {
  await db.delete(serverConfig).where(eq(serverConfig.key, key));
}

export async function normalizeAndBackfillConfig(key: ServerConfigKey): Promise<boolean> {
  const config = await db.query.serverConfig.findFirst({
    where: eq(serverConfig.key, key),
  });

  if (!config) {
    return false;
  }

  const raw = getStoredConfigValue(config, true, key);

  if (!raw) {
    return false;
  }

  const normalization = normalizeConfigValue(key, raw.value);

  if (!normalization.success || !configsDiffer(raw.value, normalization.data)) {
    return false;
  }

  await setConfig(key, normalization.data, null, config.isSensitive);

  return true;
}

export async function getAllConfigs(
  includeSecrets = false
): Promise<Record<ServerConfigKey, unknown>> {
  const configs = await db.query.serverConfig.findMany();

  const result: Record<string, unknown> = {};

  for (const config of configs) {
    const raw = getStoredConfigValue(config, includeSecrets, config.key);

    result[config.key] = raw?.value ?? null;
  }

  return result as Record<ServerConfigKey, unknown>;
}

export async function getAllConfigKeys(): Promise<ServerConfigMetadata[]> {
  const configs = await db.query.serverConfig.findMany({
    columns: {
      key: true,
      updatedAt: true,
      updatedBy: true,
      isSensitive: true,
    },
  });

  return configs.map((c) => ({
    key: c.key,
    updatedAt: c.updatedAt,
    updatedBy: c.updatedBy,
    hasSensitiveData: c.isSensitive,
  }));
}

export async function getConfigSecret(key: ServerConfigKey, field: string): Promise<string | null> {
  const config = await db.query.serverConfig.findFirst({
    where: eq(serverConfig.key, key),
  });

  if (!config || !config.isSensitive || !config.valueEnc) {
    return null;
  }

  try {
    const decrypted = decrypt(config.valueEnc);
    const parsed = JSON.parse(decrypted);

    return parsed[field] ?? null;
  } catch (error) {
    dbLogger.error({ err: error, key, field }, "Failed to get secret field");

    return null;
  }
}

export async function configExists(key: ServerConfigKey): Promise<boolean> {
  const config = await db.query.serverConfig.findFirst({
    where: eq(serverConfig.key, key),
    columns: { id: true },
  });

  return config !== null && config !== undefined;
}

const SENSITIVE_FIELDS = [
  "clientSecret",
  "apiKey",
  "secret",
  "password",
  "token",
  "transcriptionApiKey",
];

/**
 * Merge sensitive fields from existing config with new values.
 * If a sensitive field in the new value is empty/undefined or matches the mask,
 * preserve the existing value.
 */
function mergeSensitiveFields(existing: unknown, incoming: unknown): unknown {
  if (
    typeof existing !== "object" ||
    existing === null ||
    typeof incoming !== "object" ||
    incoming === null
  ) {
    return incoming;
  }

  const existingObj = existing as Record<string, unknown>;
  const incomingObj = incoming as Record<string, unknown>;
  const merged = { ...incomingObj };

  for (const field of SENSITIVE_FIELDS) {
    const incomingValue = incomingObj[field];
    const existingValue = existingObj[field];

    // If incoming is empty, undefined, or the mask placeholder, preserve existing
    if (
      incomingValue === undefined ||
      incomingValue === null ||
      incomingValue === "" ||
      incomingValue === "••••••••"
    ) {
      if (existingValue !== undefined && existingValue !== null) {
        merged[field] = existingValue;
      }
    }
  }

  return merged;
}

function maskSensitiveFields(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const masked = { ...(value as Record<string, unknown>) };

  for (const field of SENSITIVE_FIELDS) {
    if (field in masked && typeof masked[field] === "string" && masked[field] !== "") {
      masked[field] = "••••••••";
    }
  }

  return masked;
}

function configsDiffer(stored: unknown, normalized: unknown): boolean {
  return normalizeForComparison(stored) !== normalizeForComparison(normalized);
}

function normalizeForComparison(value: unknown): string {
  return (
    JSON.stringify(value, (_, nestedValue) => (nestedValue === undefined ? null : nestedValue)) ??
    "undefined"
  );
}

function getStoredConfigValue(
  config: typeof serverConfig.$inferSelect,
  includeSecrets: boolean,
  key: ServerConfigKey
): { value: unknown } | null {
  if (config.isSensitive && config.valueEnc) {
    if (includeSecrets) {
      try {
        const decrypted = decrypt(config.valueEnc);

        return {
          value: JSON.parse(decrypted),
        };
      } catch (error) {
        dbLogger.error({ err: error, key }, "Failed to decrypt config");

        return null;
      }
    }

    return {
      value: config.value,
    };
  }

  return {
    value: config.value,
  };
}
