import type { User } from "@/types";
import type { UserPreferencesDto } from "@/server/db/zodSchemas/user";

export function getUserPreferences(
  user: Pick<User, "preferences"> | null | undefined
): UserPreferencesDto {
  return user?.preferences ?? {};
}

export function getTimersEnabledPreference(
  user: Pick<User, "preferences"> | null | undefined,
  fallback = true
): boolean {
  const value = getUserPreferences(user).timersEnabled;

  return typeof value === "boolean" ? value : fallback;
}

export function getShowConversionButtonPreference(
  user: Pick<User, "preferences"> | null | undefined,
  fallback = true
): boolean {
  const value = getUserPreferences(user).showConversionButton;

  return typeof value === "boolean" ? value : fallback;
}
