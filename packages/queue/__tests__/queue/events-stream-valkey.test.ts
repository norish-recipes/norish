// @vitest-environment node
/**
 * A queue's events stream against a real Valkey. Every progress write appends
 * the job's whole progress to it and nothing reads it back, so it is capped,
 * and a stream grown under BullMQ's default cap of 10,000 is cut by its next event.
 * Valkey trims a stream approximately, a whole node of entries (100 by
 * default) at a time, so "at the cap" means within one node of it.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { ValkeyContainer } from "@testcontainers/valkey";
import { Queue } from "bullmq";
import Valkey from "ioredis";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { VALKEY_IMAGE, valkeyUrl } from "../../../shared-server/__tests__/helpers/valkey";
import { QUEUE_NAMES } from "../../src/queue-names";
import { closeAllQueues, EVENTS_MAX_LEN, getQueues, initializeQueues } from "../../src/registry";
import { closeBullConnection, getBullConnectionOptions } from "../../src/valkey/bullmq";

const config = vi.hoisted(() => ({ url: "" }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get VALKEY_URL() {
      return config.url;
    },
  },
}));
vi.mock("@norish/db/repositories/server-config", () => ({ getConfig: async () => null }));

const STREAM_NODE = 100;
const EVENTS = `bull:${QUEUE_NAMES.RECIPE_IMPORT}:events`;

let container: StartedValkeyContainer;
let valkey: Valkey;

beforeAll(async () => {
  container = await new ValkeyContainer(VALKEY_IMAGE).start();
  config.url = valkeyUrl(container);
  valkey = new Valkey(getBullConnectionOptions(config.url));
});

afterAll(async () => {
  await closeAllQueues();
  await closeBullConnection();
  valkey?.disconnect();
  await container?.stop();
});

it("cuts a stream grown under BullMQ's default cap down to the cap at its next event", async () => {
  // Before the upgrade: the queue under BullMQ's default of 10,000 events.
  const before = new Queue(QUEUE_NAMES.RECIPE_IMPORT, {
    connection: getBullConnectionOptions(config.url),
  });
  const job = await before.add("import", {});

  for (let step = 0; step < 3 * EVENTS_MAX_LEN; step++) await job.updateProgress(step);
  await before.close();
  expect(await valkey.xlen(EVENTS)).toBeGreaterThan(2 * EVENTS_MAX_LEN);

  await initializeQueues();
  // Booting writes the new cap to the queue's metadata; the next event trims to it.
  await expect
    .poll(() => valkey.hget(`bull:${QUEUE_NAMES.RECIPE_IMPORT}:meta`, "opts.maxLenEvents"))
    .toBe(String(EVENTS_MAX_LEN));
  await getQueues().recipeImport.add("import", {
    url: "https://example.com/recipe",
    recipeId: "recipe-0",
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: null,
  });

  expect(await valkey.xlen(EVENTS)).toBeLessThanOrEqual(EVENTS_MAX_LEN + STREAM_NODE);
}, 60_000);

it("keeps the stream at its cap however many progress writes a job makes", async () => {
  const job = await getQueues().recipeImport.add("import", {
    url: "https://example.com/recipe",
    recipeId: "recipe-1",
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: null,
  });

  for (let step = 0; step < 3 * EVENTS_MAX_LEN; step++) await job.updateProgress(step);

  expect(await valkey.xlen(EVENTS)).toBeLessThanOrEqual(EVENTS_MAX_LEN + STREAM_NODE);
}, 60_000);
