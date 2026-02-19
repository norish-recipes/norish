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

export function getShowRatingsPreference(
  user: Pick<User, "preferences"> | null | undefined,
  fallback = true
): boolean {
  const value = getUserPreferences(user).showRatings;

  return typeof value === "boolean" ? value : fallback;
}

export function getShowFavoritesPreference(
  user: Pick<User, "preferences"> | null | undefined,
  fallback = true
): boolean {
  const value = getUserPreferences(user).showFavorites;

  return typeof value === "boolean" ? value : fallback;
}

export function getLocalePreference(
  user: Pick<User, "preferences"> | null | undefined
): string | null {
  const value = getUserPreferences(user).locale;

  return typeof value === "string" ? value : null;
}
