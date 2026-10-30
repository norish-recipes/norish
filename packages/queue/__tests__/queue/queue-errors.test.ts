/**
 * A Queue with no `error` listener has BullMQ print the error with
 * console.error, past Norish's logger. Every queue the registry builds
 * attaches one.
 */
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAllQueueEntries, initializeQueues } from "../../src/registry";

const logged = vi.hoisted(() => vi.fn());

vi.mock("bullmq", async (importOriginal) => ({
  ...(await importOriginal<typeof import("bullmq")>()),
  Queue: class extends EventEmitter {
    constructor(readonly name: string) {
      super();
    }
  },
}));

vi.mock("@norish/queue/valkey/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/db/repositories/server-config", () => ({ getConfig: async () => null }));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: logged,
  }),
}));

beforeEach(() => {
  logged.mockReset();
});

describe("a Queue's error", () => {
  it("reaches the logger from every queue", async () => {
    await initializeQueues();

    for (const { queue } of getAllQueueEntries()) {
      const err = new Error("Connection is closed.");

      queue.emit("error", err);
      expect(logged).toHaveBeenLastCalledWith({ err, queueName: queue.name }, "Queue error");
    }
    expect(logged).toHaveBeenCalledTimes(getAllQueueEntries().length);
  });
});
