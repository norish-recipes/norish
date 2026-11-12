import { toProviderType } from "@/features/auth/utils/redirect";

import type { ProviderInfo } from "@norish/shared/contracts";

/**
 * The display name of the route's provider when the server lists it as OAuth, null for the unnamed
 * line, or undefined until the provider list has settled, so the line never changes once shown.
 */
export function failedProviderName(
  routeProvider: string | undefined,
  providers: ProviderInfo[],
  settled: boolean
): string | null | undefined {
  if (!settled) return undefined;

  const match = providers.find(
    (provider) => provider.id === routeProvider && toProviderType(provider) === "oauth"
  );

  return match?.name ?? null;
}
