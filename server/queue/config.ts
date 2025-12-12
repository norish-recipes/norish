import type { ConnectionOptions, DefaultJobOptions } from "bullmq";

import { SERVER_CONFIG } from "@/config/env-config-server";

export const redisConnection: ConnectionOptions = {
  host: new URL(SERVER_CONFIG.REDIS_URL).hostname,
  port: parseInt(new URL(SERVER_CONFIG.REDIS_URL).port || "6379", 10),
  password: new URL(SERVER_CONFIG.REDIS_URL).password || undefined,
};

export const recipeImportJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000, // 1s, 2s, 4s
  },
  removeOnComplete: true,
  removeOnFail: true
};

export const caldavSyncJobOptions: DefaultJobOptions = {
  attempts: 10,
  backoff: {
    type: "exponential",
    delay: 60000, // 1m, 2m, 4m, 8m... up to 17h
  },
  removeOnComplete: true,
  removeOnFail: true, // Failed state persisted to Postgres
};

export const QUEUE_NAMES = {
  RECIPE_IMPORT: "recipe-import",
  CALDAV_SYNC: "caldav-sync",
} as const;

