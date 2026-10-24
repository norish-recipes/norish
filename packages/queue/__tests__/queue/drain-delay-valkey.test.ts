// @vitest-environment node
/**
 * An idle worker against a real Valkey: BullMQ reads `drainDelay` in seconds and
 * blocks on Valkey that long per wait. Each wait shows up as a BZPOPMIN, so a
 * second one within a few seconds proves the first one ended.
 */
import { once } from "node:events";
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { ValkeyContainer } from "@testcontainers/valkey";
import { Worker } from "bullmq";
import Valkey from "ioredis";
import { afterAll, beforeAll, expect, it } from "vitest";

import { VALKEY_IMAGE, valkeyUrl } from "../../../shared-server/__tests__/helpers/valkey";
import { baseWorkerOptions } from "../../src/config";
import { getBullConnectionOptions } from "../../src/valkey/bullmq";

let valkey: StartedValkeyContainer;

beforeAll(async () => {
  valkey = await new ValkeyContainer(VALKEY_IMAGE).start();
});

afterAll(async () => {
  await valkey?.stop();
});

it("ends an idle worker's blocking wait within seconds", async () => {
  const connection = getBullConnectionOptions(valkeyUrl(valkey));
  // A lone monitor client: ioredis reads another client's command landing before its
  // MONITOR reply settles as a reply to nothing, and `valkey.monitor()` adds that client.
  const monitor = new Valkey({ ...connection, monitor: true });

  await once(monitor, "monitoring");
  const waits: number[] = [];

  monitor.on("monitor", (_time: string, args: string[]) => {
    if (args[0]?.toLowerCase() === "bzpopmin") waits.push(Date.now());
  });

  const worker = new Worker("drain-delay-valkey-test", async () => {}, {
    ...baseWorkerOptions,
    connection,
  });

  try {
    await expect.poll(() => waits.length, { timeout: 10_000, interval: 100 }).toBeGreaterThan(1);
    expect(waits[1]! - waits[0]!).toBeLessThan(7_000);
  } finally {
    await worker.close();
    monitor.disconnect();
  }
}, 30_000);
