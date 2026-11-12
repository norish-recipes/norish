import { toProviderType } from "@/features/auth/utils/redirect";

import type { ProviderInfo } from "@norish/shared/contracts";

// Module scope: the OAuth sheet's return can remount the tree, and the error route has no provider of its own.
let attempted: string | undefined;

export function rememberProviderAttempt(providerId: string) {
  attempted = providerId;
}

export function lastProviderAttempt() {
  return attempted;
}

/**
 * The display name of the provider a failed sign-in came from: the route's own, else the last one
 * tried, when the server still lists it as OAuth; null leaves the line unnamed.
 */
export function failedProviderName(
  routeProvider: string | undefined,
  attemptedProvider: string | undefined,
  providers: ProviderInfo[]
): string | null {
  const oauth = providers.filter((provider) => toProviderType(provider) === "oauth");

  for (const id of [routeProvider, attemptedProvider]) {
    const match = id ? oauth.find((provider) => provider.id === id) : undefined;

    if (match) return match.name;
  }

  return null;
}
