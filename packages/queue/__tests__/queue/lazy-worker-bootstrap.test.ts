import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createLazyWorker: vi.fn(),
  stopLazyWorker: vi.fn(),
  connection: {},
}));

vi.mock("../../src/lazy-worker-manager", () => ({
  createLazyWorker: mocks.createLazyWorker,
  stopLazyWorker: mocks.stopLazyWorker,
}));

vi.mock("../../src/redis/bullmq", () => ({ getBullClient: () => mocks.connection }));

const { defineLazyWorker } = await import("../../src/config");

describe("defineLazyWorker", () => {
  it("applies the standard queue configuration to start and stop", async () => {
    const processor = vi.fn();
    const onFailed = vi.fn();
    const worker = defineLazyWorker("auto-tagging", processor, onFailed);

    await worker.start();
    await worker.stop();

    expect(mocks.createLazyWorker).toHaveBeenCalledWith(
      "auto-tagging",
      processor,
      expect.objectContaining({
        connection: mocks.connection,
        concurrency: 2,
        stalledInterval: 60_000,
        lockDuration: 60_000,
      }),
      onFailed
    );
    expect(mocks.stopLazyWorker).toHaveBeenCalledWith("auto-tagging");
  });
});
