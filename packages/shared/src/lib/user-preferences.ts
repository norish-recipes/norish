import type { User } from "@norish/shared/contracts";
import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import { AFTER_PLANNING_CHOICES } from "@norish/shared/contracts/zod/user";

export type AfterPlanning = (typeof AFTER_PLANNING_CHOICES)[number];

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

/** What happens once a recipe is planned; the groceries panel unless the user chose otherwise. */
export function getAfterPlanningPreference(
  user: Pick<User, "preferences"> | null | undefined
): AfterPlanning {
  const value = getUserPreferences(user).afterPlanning;

  return AFTER_PLANNING_CHOICES.includes(value as AfterPlanning)
    ? (value as AfterPlanning)
    : "openGroceries";
}
