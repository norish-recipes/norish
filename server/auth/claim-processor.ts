import type { OIDCClaimConfig } from "@/server/db/zodSchemas/server-config";
import type { HouseholdUserInfo } from "@/server/trpc/routers/households/types";

import { authLogger } from "@/server/logger";
import {
  findOrCreateHouseholdByName,
  addUserToHousehold,
  getHouseholdForUser,
  getUsersByHouseholdId,
} from "@/server/db/repositories/households";
import { setUserAdminStatus, getUserById } from "@/server/db/repositories/users";
import { invalidateHouseholdCacheForUsers } from "@/server/db/cached-household";
import { emitConnectionInvalidation } from "@/server/trpc/connection-manager";
import { householdEmitter } from "@/server/trpc/routers/households/emitter";
import { getPublisherClient } from "@/server/redis/client";

// Redis key prefix and TTL for OIDC profiles during auth flow
const OIDC_PROFILE_PREFIX = "oidc:profile:";
const OIDC_PROFILE_TTL = 300; // 5 minutes

/**
 * Store OIDC profile in Redis for claim processing after account creation.
 */
export async function storeOIDCProfile(
  accountId: string,
  profile: Record<string, unknown>
): Promise<void> {
  try {
    const redis = await getPublisherClient();

    await redis.setex(
      `${OIDC_PROFILE_PREFIX}${accountId}`,
      OIDC_PROFILE_TTL,
      JSON.stringify(profile)
    );
  } catch (error) {
    authLogger.error({ error, accountId }, "Failed to store OIDC profile in Redis");
  }
}

/**
 * Retrieve and delete OIDC profile from Redis.
 */
export async function getPendingOIDCProfile(
  accountId: string
): Promise<Record<string, unknown> | null> {
  try {
    const redis = await getPublisherClient();
    const key = `${OIDC_PROFILE_PREFIX}${accountId}`;
    const data = await redis.get(key);

    if (data) {
      await redis.del(key); // Clean up after retrieval

      return JSON.parse(data);
    }

    return null;
  } catch (error) {
    authLogger.error({ error, accountId }, "Failed to retrieve OIDC profile from Redis");

    return null;
  }
}

/**
 * Decode a JWT payload without verification.
 * Used to extract claims from ID tokens - verification is handled by BetterAuth.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) return null;

    // JWT payload is the second part, base64url encoded
    const payload = parts[1]!;
    // Convert base64url to base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    // Decode and parse
    const json = Buffer.from(base64, "base64").toString("utf-8");

    return JSON.parse(json);
  } catch {
    return null;
  }
}

export interface OIDCTokens {
  accessToken: string;
  idToken?: string;
}

export interface MergedClaimsResult {
  profile: Record<string, unknown>;
  groupsSource: "id_token" | "userinfo" | "none";
}

/**
 * Merge claims from ID token and userinfo endpoint.
 * ID token claims take precedence (especially for groups from Authentik/Keycloak).
 * Userinfo is fetched as fallback/base (works for PocketID).
 */
export async function mergeOIDCTokenClaims(
  tokens: OIDCTokens,
  discoveryUrl: string
): Promise<MergedClaimsResult | null> {
  let idTokenClaims: Record<string, unknown> = {};
  let userInfoClaims: Record<string, unknown> = {};

  // 1. Try to decode ID token first (contains groups for Authentik, Keycloak, etc.)
  if (tokens.idToken) {
    const decoded = decodeJwtPayload(tokens.idToken);

    if (decoded) {
      idTokenClaims = decoded;
      authLogger.debug(
        { sub: decoded.sub, hasGroups: "groups" in decoded },
        "Decoded ID token claims"
      );
    }
  }

  // 2. Fetch from userinfo endpoint (contains groups for PocketID, some other providers)
  try {
    const discoveryRes = await fetch(discoveryUrl);
    const discovery = await discoveryRes.json();
    const userInfoUrl = discovery.userinfo_endpoint;

    if (userInfoUrl) {
      const userInfoRes = await fetch(userInfoUrl, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });

      if (userInfoRes.ok) {
        userInfoClaims = await userInfoRes.json();
        authLogger.debug(
          { sub: userInfoClaims.sub, hasGroups: "groups" in userInfoClaims },
          "Fetched userinfo claims"
        );
      }
    }
  } catch (error) {
    authLogger.warn({ error }, "Failed to fetch userinfo, using ID token only");
  }

  // 3. Merge claims: userinfo as base, ID token overwrites (especially for groups)
  const profile = { ...userInfoClaims, ...idTokenClaims };

  // Ensure we have a sub claim
  if (!profile.sub) {
    authLogger.error("No sub claim found in ID token or userinfo");

    return null;
  }

  const groupsSource =
    "groups" in idTokenClaims ? "id_token" : "groups" in userInfoClaims ? "userinfo" : "none";

  return { profile, groupsSource };
}

const DEFAULT_CONFIG: Required<OIDCClaimConfig> = {
  enabled: false,
  scopes: [],
  groupsClaim: "groups",
  adminGroup: "norish_admin",
  householdPrefix: "norish_household_",
};

interface ProcessedClaims {
  isAdmin: boolean;
  householdName: string | null;
  rawGroups: string[];
}

/**
 * Extract groups from OIDC profile
 * Handles array, space-separated string, and comma-separated string formats
 */
function extractGroups(profile: Record<string, unknown>, claimName: string): string[] {
  const claim = profile[claimName];

  if (Array.isArray(claim)) {
    return claim.filter((g): g is string => typeof g === "string");
  }

  if (typeof claim === "string") {
    return claim.split(/[,\s]+/).filter(Boolean);
  }

  return [];
}

/**
 * Parse OIDC claims and determine admin status + household
 */
export function parseOIDCClaims(
  profile: Record<string, unknown>,
  config?: Partial<OIDCClaimConfig>
): ProcessedClaims {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const groups = extractGroups(profile, cfg.groupsClaim);

  // Check for admin group (case-insensitive)
  const adminGroupLower = cfg.adminGroup.toLowerCase();
  const isAdmin = groups.some((g) => g.toLowerCase() === adminGroupLower);

  // Find household groups (case-insensitive prefix match)
  const prefixLower = cfg.householdPrefix.toLowerCase();
  const householdGroups = groups
    .filter((g) => g.toLowerCase().startsWith(prefixLower))
    .map((g) => g.slice(cfg.householdPrefix.length))
    .filter((name) => name.length > 0)
    .sort(); // Alphabetical for deterministic "first wins"

  const householdName = householdGroups[0] ?? null;

  if (householdGroups.length > 1) {
    authLogger.warn(
      { groups: householdGroups, selected: householdName },
      "User has multiple household claims, using first alphabetically"
    );
  }

  return { isAdmin, householdName, rawGroups: groups };
}

/**
 * Process OIDC claims for a user after login
 * - Only processes if claim mapping is enabled
 * - Updates admin status on every login
 * - Joins household only if user is not already in one
 */
export async function processClaimsForUser(
  userId: string,
  profile: Record<string, unknown>,
  config?: Partial<OIDCClaimConfig>
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Skip processing if claim mapping is disabled
  if (!cfg.enabled) {
    authLogger.debug({ userId }, "OIDC claim mapping is disabled, skipping");

    return;
  }

  const claims = parseOIDCClaims(profile, config);

  authLogger.debug(
    { userId, isAdmin: claims.isAdmin, household: claims.householdName, groups: claims.rawGroups },
    "Processing OIDC claims for user"
  );

  // Always sync admin status based on claims
  await setUserAdminStatus(userId, claims.isAdmin);

  if (claims.isAdmin) {
    authLogger.info({ userId }, "User granted admin via OIDC claim");
  }

  // Only process household if user has a claim and is not already in a household
  if (claims.householdName) {
    const existingHousehold = await getHouseholdForUser(userId);

    if (existingHousehold) {
      authLogger.debug(
        {
          userId,
          existingHousehold: existingHousehold.name,
          claimedHousehold: claims.householdName,
        },
        "User already in household, skipping claim-based assignment"
      );

      return;
    }

    // Find or create the household
    const household = await findOrCreateHouseholdByName(claims.householdName, userId);

    // Get existing members before adding the new user (for notifications)
    const existingMembers = await getUsersByHouseholdId(household.id);
    const existingMemberIds = existingMembers.map((m) => m.userId);

    // Add user to household
    await addUserToHousehold({ householdId: household.id, userId });

    authLogger.info(
      { userId, householdId: household.id, householdName: claims.householdName },
      "User joined household via OIDC claim"
    );

    // Emit WebSocket events for real-time sync
    const user = await getUserById(userId);
    const userInfo: HouseholdUserInfo = {
      id: userId,
      name: user?.name ?? null,
      isAdmin: false,
    };

    // Notify existing household members about the new user
    householdEmitter.emitToHousehold(household.id, "userJoined", { user: userInfo });

    // Invalidate cache for all affected users
    await invalidateHouseholdCacheForUsers([userId, ...existingMemberIds]);

    // Emit connection invalidation for the joining user to refresh their session
    await emitConnectionInvalidation(userId, "household-joined-via-oidc");
  }
}
