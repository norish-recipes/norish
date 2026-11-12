import { toProviderType } from "@/features/auth/utils/redirect";

import type { AuthProvidersResponse, ProviderInfo } from "@norish/shared/contracts";

/** What Sign in draws: exactly the Sign-in Methods the server reports, never more. */
export type SignInMethods = {
  passwordForm: boolean;
  oauthProviders: ProviderInfo[];
  divider: boolean;
  signUp: boolean;
};

export function resolveSignInMethods({
  providers,
  passwordAuthEnabled,
  registrationEnabled,
}: AuthProvidersResponse): SignInMethods {
  const oauthProviders = providers.filter((provider) => toProviderType(provider) === "oauth");

  return {
    passwordForm: passwordAuthEnabled,
    oauthProviders,
    divider: passwordAuthEnabled && oauthProviders.length > 0,
    signUp: passwordAuthEnabled && registrationEnabled,
  };
}
