import type { EnrichAllJobData } from "@norish/queue/contracts/job-types";

import { getQueues } from "../registry";

/** The one Enrich All a server runs at a time: a second ask while it waits or runs is dropped. */
export const ENRICH_ALL_DEDUPLICATION_ID = "enrich-all-recipes";

/** Queue an administrator's Enrich All; the sweep runs in the worker, not the request. */
export async function addEnrichAllJob(data: EnrichAllJobData): Promise<void> {
  await getQueues().enrichAll.add("enrich-all", data, {
    deduplication: { id: ENRICH_ALL_DEDUPLICATION_ID },
  });
}
