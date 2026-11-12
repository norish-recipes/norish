import { toProviderType } from "@/features/auth/utils/redirect";

import type { AuthProvidersResponse, ProviderInfo } from "@norish/shared/contracts";

/** What Sign in draws: exactly the Sign-in Methods the server reports, never more. */
export type SignInMethods = {
  passwordForm: boolean;
  oauthProviders: ProviderInfo[];
  providerButtons: boolean;
  divider: boolean;
  signUp: boolean;
  /** The server offers no method at all, so Sign in says to ask the administrator. */
  noMethod: boolean;
};

export function resolveSignInMethods({
  providers,
  passwordAuthEnabled,
  registrationEnabled,
}: AuthProvidersResponse): SignInMethods {
  const oauthProviders = providers.filter((provider) => toProviderType(provider) === "oauth");
  const providerButtons = oauthProviders.length > 0;

  return {
    passwordForm: passwordAuthEnabled,
    oauthProviders,
    providerButtons,
    divider: passwordAuthEnabled && providerButtons,
    signUp: passwordAuthEnabled && registrationEnabled,
    noMethod: !passwordAuthEnabled && !providerButtons,
  };
}

export type MethodsStatus = "loading" | "failed" | "ready";

/** Whether Sign in has methods to draw; a first fetch paused offline is a failure, not "none". */
export function resolveMethodsStatus(config: {
  isLoading: boolean;
  isPaused: boolean;
  error: unknown;
  hasData: boolean;
}): MethodsStatus {
  if (config.isLoading) return "loading";
  if (!config.hasData && (config.error || config.isPaused)) return "failed";

  return "ready";
}
