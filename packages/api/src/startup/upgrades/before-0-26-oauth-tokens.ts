import { clearStoredOAuthTokens } from "@norish/db/repositories/upgrades";

/** Releases before 0.26 stored each sign-in provider's tokens, which Norish only needs while signing in. */
export async function upgradeOAuthTokens(): Promise<number> {
  return await clearStoredOAuthTokens();
}
