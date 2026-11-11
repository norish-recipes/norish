import { QuerySeed } from "@/components/query-seed";

import { readCaldavShape } from "../read-settings-shape";
import CalDavSettingsContent from "./components/caldav-settings-content";
import { FIRST_SYNC_STATUS_PAGE } from "./first-sync-status-page";

// Not the password (the worker caches documents) nor the connection check (a request to the
// CalDAV server).
export default async function CalDavSettingsPage() {
  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(trpc.caldav.getConfig.queryOptions()),
        client.query(trpc.caldav.getSyncStatus.queryOptions(FIRST_SYNC_STATUS_PAGE)),
        client.query(trpc.caldav.getSummary.queryOptions()),
      ]}
    >
      <CalDavSettingsContent shape={await readCaldavShape()} />
    </QuerySeed>
  );
}
