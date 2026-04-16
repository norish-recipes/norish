import type { PersistedClient, Persister } from "@tanstack/query-persist-client-core";
import { queryCacheStorage } from "@/lib/storage/query-cache-mmkv";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("query-persister");
const STORAGE_KEY = "tanstack-query-cache";

export function createMmkvPersister(): Persister {
  return {
    persistClient(client: PersistedClient) {
      try {
        queryCacheStorage.set(STORAGE_KEY, JSON.stringify(client));
      } catch (error) {
        log.warn({ error }, "Failed to persist query cache");
      }
    },

    restoreClient(): PersistedClient | undefined {
      try {
        const raw = queryCacheStorage.getString(STORAGE_KEY);

        if (!raw) {
          return undefined;
        }

        return JSON.parse(raw) as PersistedClient;
      } catch (error) {
        log.warn({ error }, "Failed to restore query cache, clearing storage");
        queryCacheStorage.delete(STORAGE_KEY);

        return undefined;
      }
    },

    removeClient() {
      try {
        queryCacheStorage.delete(STORAGE_KEY);
      } catch (error) {
        log.warn({ error }, "Failed to remove persisted query cache");
      }
    },
  };
}
