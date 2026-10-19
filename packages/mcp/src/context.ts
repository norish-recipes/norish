import type { SessionIdentity } from "@norish/db/repositories/users";
import { verifyApiKeyForRequest } from "@norish/db/repositories/api-keys";
import { getHouseholdForUser } from "@norish/db/repositories/households";
import { getUserSessionIdentity } from "@norish/db/repositories/users";

export type McpCaller = {
  userId: string;
  userIds: string[];
  householdUserIds: string[] | null;
  householdKey: string;
  isServerAdmin: boolean;
};

export type McpAuthResult =
  | { status: "authenticated"; caller: McpCaller }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "invalid" };

const BEARER = /^Bearer\s+(.+)$/i;

export function readApiKey(headers: Headers): string | null {
  const direct = headers.get("x-api-key")?.trim();

  if (direct) return direct;

  const bearerHeader = headers.get("bearer")?.trim();

  if (bearerHeader) return bearerHeader;

  const authorization = headers.get("authorization")?.trim();

  if (!authorization) return null;

  const match = BEARER.exec(authorization);

  return match?.[1]?.trim() || null;
}

async function toCaller(identity: SessionIdentity): Promise<McpCaller> {
  const household = await getHouseholdForUser(identity.id);
  const memberIds = household?.users.map((member) => member.id) ?? [];
  const userIds = [identity.id, ...memberIds].filter((id, index, all) => all.indexOf(id) === index);

  return {
    userId: identity.id,
    userIds,
    householdUserIds: memberIds.length > 0 ? memberIds : null,
    householdKey: household?.id ?? identity.id,
    isServerAdmin: identity.isServerAdmin,
  };
}

export async function authenticateMcpRequest(headers: Headers): Promise<McpAuthResult> {
  const apiKey = readApiKey(headers);

  if (!apiKey) return { status: "invalid" };

  const verification = await verifyApiKeyForRequest(apiKey);

  if (verification.status === "rate_limited") {
    return { status: "rate_limited", retryAfterSeconds: verification.retryAfterSeconds };
  }

  if (verification.status === "invalid") {
    return { status: "invalid" };
  }

  const identity = await getUserSessionIdentity(verification.userId);

  if (!identity) return { status: "invalid" };

  return { status: "authenticated", caller: await toCaller(identity) };
}
