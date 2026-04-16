import type { ProviderInfo } from "@norish/shared/contracts";

export const DEFAULT_PROTECTED_ROUTE = "/(tabs)";

export function sanitizeRedirectTarget(target: string | null | undefined): string {
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

export function toProviderType(provider: ProviderInfo): "oauth" | "credential" {
  if (provider.type === "credential" || provider.id === "credential") return "credential";

  return "oauth";
}
