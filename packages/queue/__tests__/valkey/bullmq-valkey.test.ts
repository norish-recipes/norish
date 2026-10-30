// @vitest-environment node
/**
 * Shutdown after a Valkey restart left the connections half-open: an idle
 * worker, the queue and the shared BullMQ client close at once, instead of
 * waiting on its run loop's command or a QUIT the dead socket never answers.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { ValkeyContainer } from "@testcontainers/valkey";
import { Queue } from "bullmq";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { freezableProxy, VALKEY_IMAGE } from "../../../shared-server/__tests__/helpers/valkey";
import { closeWorkers, createWorker } from "../../src/create-worker";
import { QUEUE_NAMES } from "../../src/queue-names";
import { closeBullConnection, getBullClient } from "../../src/valkey/bullmq";

const config = vi.hoisted(() => ({ url: "" }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get VALKEY_URL() {
      return config.url;
    },
  },
}));

let container: StartedValkeyContainer;
let proxy: ReturnType<typeof freezableProxy>;

beforeAll(async () => {
  container = await new ValkeyContainer(VALKEY_IMAGE).start();
  proxy = freezableProxy({ host: container.getHost(), port: container.getPort() });
  config.url = await proxy.listen();
});

afterAll(async () => {
  await proxy?.close();
  await container?.stop();
});

// Given half of BULL_SOCKET_TIMEOUT_MS: a close that waited on the dead sockets would sit it out.
it("closes every BullMQ connection at once when the sockets have gone half-open", async () => {
  const queue = new Queue(QUEUE_NAMES.RECIPE_IMPORT, { connection: getBullClient() });
  const worker = createWorker(QUEUE_NAMES.RECIPE_IMPORT, async () => {});

  queue.on("error", () => {});
  await Promise.all([queue.waitUntilReady(), worker.waitUntilReady()]);
  // The worker's run loop has a command in flight when the socket goes dead.
  proxy.freeze();

  await closeWorkers(10_000);
  await queue.close();
  await closeBullConnection();
}, 7_500);
