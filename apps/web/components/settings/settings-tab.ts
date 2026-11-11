export const SETTINGS_TABS = ["account", "household", "caldav", "ingredients", "admin"] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** Which household cards the reader gets: none, a member's or the admin's. */
export type HouseholdShape = "none" | "member" | "admin";

/** Which CalDAV cards the reader gets: setup, a disabled config, or the config and sync status. */
export type CaldavShape = "none" | "disabled" | "enabled";

/** The tab a `/settings/<tab>` path names, if any. */
export function settingsTabOf(pathname: string): SettingsTab | undefined {
  const segment = pathname.split("/")[2];

  return SETTINGS_TABS.find((tab) => tab === segment);
}
