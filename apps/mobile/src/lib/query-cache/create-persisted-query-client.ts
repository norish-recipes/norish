import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core";
import { QueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";

import { createClientLogger } from "@norish/shared/lib/logger";

import { createMmkvPersister } from "./mmkv-persister";

const log = createClientLogger("query-cache");

/** 24 hours in ms. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24;

const APP_VERSION =
  Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? "0.0.0";

type PersistedQueryClientResult = {
  queryClient: QueryClient;
  /**
   * Promise that resolves when the persisted cache has been restored.
   * Must be awaited before rendering authenticated query consumers so
   * cached data is available on the first render.
   */
  restorePromise: Promise<void>;
};

/**
 * Creates a `QueryClient` with MMKV-backed persistence.
 */
export function createPersistedQueryClient(): PersistedQueryClientResult {
  const persister = createMmkvPersister();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        refetchOnMount: "always",
        retry: 1,
      },
      mutations: {
        networkMode: "always",
        retry: 0,
      },
    },
  });

  const restorePromise = persistQueryClientRestore({
    queryClient,
    persister,
    maxAge: MAX_AGE_MS,
    buster: APP_VERSION,
  })
    .then(() => {
      log.info("Query cache restored from MMKV");
    })
    .catch((error) => {
      log.warn({ error }, "Query cache restore failed, starting fresh");
    })
    .then(() => {
      // Subscribe to keep cache persisted after restore, regardless of success/failure
      persistQueryClientSubscribe({
        queryClient,
        persister,
        buster: APP_VERSION,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === "success",
        },
      });
    });

  return { queryClient, restorePromise };
}
