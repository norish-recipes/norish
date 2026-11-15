import { QuerySeed } from "@/components/query-seed";
import { CaldavScreen } from "@/features/calendar/caldav-screen";
import { FIRST_SYNC_STATUS_PAGE } from "@/features/calendar/components/caldav/first-sync-status-page";

import { readCaldavShape } from "./read-caldav-shape";

// A full load seeds the config, sync status and summary; not the password (the worker caches
// documents) nor the connection check (a request to the CalDAV server).
export default async function CaldavSettingsPage() {
  return (
    <QuerySeed
      reads={(trpc, client) => [
        client.query(trpc.caldav.getConfig.queryOptions()),
        client.query(trpc.caldav.getSyncStatus.queryOptions(FIRST_SYNC_STATUS_PAGE)),
        client.query(trpc.caldav.getSummary.queryOptions()),
      ]}
    >
      <CaldavScreen shape={await readCaldavShape()} />
    </QuerySeed>
  );
}
