export const SETTINGS_TABS = ["account", "household", "caldav", "ingredients", "admin"] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** A settings tab's address. */
export function settingsHref(tab: SettingsTab) {
  return `/settings/${tab}`;
}

/** The tab settings opens on. */
export const SETTINGS_HREF = settingsHref("account");

/** The tab a `/settings/<tab>` path names, if any. */
export function settingsTabOf(pathname: string): SettingsTab | undefined {
  const segment = pathname.split("/")[2];

  return SETTINGS_TABS.find((tab) => tab === segment);
}
