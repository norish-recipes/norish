import type { User } from "@norish/shared/contracts";
import type { HiddenItem, UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import { HIDDEN_ITEMS } from "@norish/shared/contracts/zod/user";

export function getUserPreferences(
  user: Pick<User, "preferences"> | null | undefined
): UserPreferencesDto {
  return user?.preferences ?? {};
}

/**
 * Whether this reader wants recipe timers. Timers are a Hidden Item like any
 * other; this reads as its own question because the answer is also gated by a
 * deployment-wide setting the caller checks separately.
 */
export function getTimersEnabledPreference(
  user: Pick<User, "preferences"> | null | undefined
): boolean {
  return !isHiddenForUser(user, "timers");
}

/** What this reader has hidden. Nothing, for a reader with no preferences. */
export function getHiddenItems(
  user: Pick<User, "preferences"> | null | undefined
): readonly string[] {
  const value = getUserPreferences(user).hidden;

  return Array.isArray(value) ? value : [];
}

/**
 * Whether this reader has chosen not to be shown something. Everything is
 * shown by default, so a reader with no preferences of their own — someone
 * following a shared recipe link, say — sees the whole thing.
 */
export function isHiddenForUser(
  user: Pick<User, "preferences"> | null | undefined,
  item: HiddenItem
): boolean {
  return getHiddenItems(user).includes(item);
}

/**
 * A stored list split into what a control can show and what it must carry.
 *
 * `selected` is what the control ticks, in contract order. `carried` is
 * everything else stored: a name from a newer version this one cannot offer,
 * or one an administrator has gated off. A control writes back
 * `[...chosen, ...carried]`, so it can never drop a choice it was not in a
 * position to show.
 */
export function partitionHiddenItems(
  user: Pick<User, "preferences"> | null | undefined,
  offered: readonly HiddenItem[] = HIDDEN_ITEMS
): { selected: HiddenItem[]; carried: string[] } {
  const stored = getHiddenItems(user);
  const offeredNames = new Set<string>(offered);

  return {
    selected: offered.filter((item) => stored.includes(item)),
    carried: stored.filter((item) => !offeredNames.has(item)),
  };
}

export function getLocalePreference(
  user: Pick<User, "preferences"> | null | undefined
): string | null {
  const value = getUserPreferences(user).locale;

  return typeof value === "string" ? value : null;
}
