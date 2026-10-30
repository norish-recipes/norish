import { QuerySeed } from "@/components/query-seed";

import { FIRST_SYNC_STATUS_PAGE } from "./caldav/first-sync-status-page";
import SettingsPageContent from "./components/settings-page-content";
import { readSettingsShape } from "./read-settings-shape";
import { openSettingsTab } from "./settings-tab";

// A full load carries what the open tab draws (household's comes with the app layout). Not CalDAV's
// password (the worker caches documents) nor its connection check (a request to the CalDAV server).
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const [{ tab }, shape] = await Promise.all([searchParams, readSettingsShape()]);
  const open = openSettingsTab(Array.isArray(tab) ? tab[0] : tab, shape);

  return (
    <QuerySeed
      reads={(trpc, client) => {
        switch (open) {
          case "user":
            // `user.get` carries API-key metadata, which this tab draws anyway.
            return [
              client.query(trpc.user.get.queryOptions()),
              client.query(trpc.recipes.shareListMine.queryOptions()),
              client.query(trpc.siteAuthTokens.list.queryOptions()),
              client.query(trpc.config.localeConfig.queryOptions()),
              client.query(trpc.config.timersEnabled.queryOptions()),
              client.query(trpc.config.authProviders.queryOptions()),
              client.query(trpc.user.signInMethods.queryOptions()),
            ];
          case "caldav":
            return [
              client.query(trpc.caldav.getConfig.queryOptions()),
              client.query(trpc.caldav.getSyncStatus.queryOptions(FIRST_SYNC_STATUS_PAGE)),
              client.query(trpc.caldav.getSummary.queryOptions()),
            ];
          default:
            return [];
        }
      }}
    >
      <SettingsPageContent shape={shape} />
    </QuerySeed>
  );
}
