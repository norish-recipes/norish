// @vitest-environment node
/** A worker takes its queue's own stall policy: Enrich All never reruns after a restart. */
import { describe, expect, it, vi } from "vitest";

import { createWorker } from "../../src/create-worker";
import { QUEUE_NAMES } from "../../src/queue-names";

const options = vi.hoisted(() => new Map<string, Record<string, unknown>>());

vi.mock("bullmq", async (importOriginal) => ({
  ...(await importOriginal<typeof import("bullmq")>()),
  Worker: class {
    constructor(name: string, _processor: unknown, opts: Record<string, unknown>) {
      options.set(name, opts);
    }

    on() {}
  },
}));

vi.mock("../../src/valkey/bullmq", () => ({ getBullClient: vi.fn() }));

describe("createWorker", () => {
  it("never recovers a stalled Enrich All sweep, and recovers others once", () => {
    createWorker(QUEUE_NAMES.ENRICH_ALL, async () => {});
    createWorker(QUEUE_NAMES.AUTO_TAGGING, async () => {});

    expect(options.get(QUEUE_NAMES.ENRICH_ALL)?.maxStalledCount).toBe(0);
    expect(options.get(QUEUE_NAMES.AUTO_TAGGING)?.maxStalledCount).toBe(1);
  });
});
