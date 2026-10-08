import type { MeasurementSystem, User } from "@norish/shared/contracts";
import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import {
  AFTER_PLANNING_CHOICES,
  MEASUREMENT_SYSTEM_CHOICES,
} from "@norish/shared/contracts/zod/user";

export type AfterPlanning = (typeof AFTER_PLANNING_CHOICES)[number];
export type MeasurementSystemChoice = (typeof MEASUREMENT_SYSTEM_CHOICES)[number];

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

/** The system recipes are converted to as they open; off unless the user chose one. */
export function getMeasurementSystemPreference(
  user: Pick<User, "preferences"> | null | undefined
): MeasurementSystemChoice {
  return getUserPreferences(user).measurementSystem ?? "off";
}

/** The conversion a choice asks for, or null when off. */
export function measurementSystemTarget(
  choice: MeasurementSystemChoice
): { system: MeasurementSystem; withAI: boolean } | null {
  if (choice === "off") return null;

  return {
    system: choice.startsWith("metric") ? "metric" : "us",
    withAI: choice.endsWith("WithAI"),
  };
}
