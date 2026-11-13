import type { ProviderInfo } from "@norish/shared/contracts";

const DEFAULT_PROTECTED_ROUTE = "/";

function sanitizeRedirectTarget(target: string | null | undefined): string {
  if (!target) return DEFAULT_PROTECTED_ROUTE;
  let candidate = target;

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // keep raw
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) return DEFAULT_PROTECTED_ROUTE;
  if (candidate === "/login" || candidate.startsWith("/auth/")) return DEFAULT_PROTECTED_ROUTE;

  return candidate;
}

export function firstParam(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

/** The safe in-app target of a `redirectTo` search param. */
export function redirectTargetOf(param: string | string[] | undefined): string {
  return sanitizeRedirectTarget(firstParam(param));
}

export function toProviderType(provider: ProviderInfo): "oauth" | "credential" {
  if (provider.type === "credential" || provider.id === "credential") return "credential";

  return "oauth";
}
