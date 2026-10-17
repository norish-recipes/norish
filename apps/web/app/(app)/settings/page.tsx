import { QuerySeed } from "@/components/query-seed";

import SettingsPageContent from "./components/settings-page-content";
import { readSettingsShape } from "./read-settings-shape";

// A full load carries what the open tab draws (household's comes with the shell). Never CalDAV's
// password, a secret in a document the worker keeps, nor its connection check, a call out.
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { tab } = await searchParams;

  return (
    <QuerySeed
      reads={(trpc, client) => {
        if (tab === "caldav") {
          return [
            client.query(trpc.caldav.getConfig.queryOptions()),
            client.query(
              trpc.caldav.getSyncStatus.queryOptions({
                page: 1,
                pageSize: 20,
                statusFilter: "pending",
              })
            ),
            client.query(trpc.caldav.getSummary.queryOptions()),
          ];
        }

        if (tab === "household" || tab === "ingredients" || tab === "admin") return [];

        // The user tab, which opens by default. `user.get` carries API-key metadata, which this
        // tab draws anyway.
        return [
          client.query(trpc.user.get.queryOptions()),
          client.query(trpc.recipes.shareListMine.queryOptions()),
          client.query(trpc.siteAuthTokens.list.queryOptions()),
          client.query(trpc.config.localeConfig.queryOptions()),
          client.query(trpc.config.timersEnabled.queryOptions()),
        ];
      }}
    >
      <SettingsPageContent shape={await readSettingsShape()} />
    </QuerySeed>
  );
}
