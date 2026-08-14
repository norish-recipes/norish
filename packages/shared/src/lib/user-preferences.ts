import type { User } from "@norish/shared/contracts";
import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";

export function getUserPreferences(
  user: Pick<User, "preferences"> | null | undefined
): UserPreferencesDto {
  return user?.preferences ?? {};
}

export function getLocalePreference(
  user: Pick<User, "preferences"> | null | undefined
): string | null {
  const value = getUserPreferences(user).locale;

  return typeof value === "string" ? value : null;
}
