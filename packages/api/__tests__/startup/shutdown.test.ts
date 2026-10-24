// @vitest-environment node
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { registerShutdownHandlers } from "@norish/api/startup/shutdown";

const { stopped, step } = vi.hoisted(() => {
  const stopped: string[] = [];

  return {
    stopped,
    step: (name: string) => async () => {
      stopped.push(name);
    },
  };
});

vi.mock("@norish/api/caldav/event-listener", () => ({ stopCaldavSync: step("caldav") }));
vi.mock("@norish/api/recipes/enrichment-listener", () => ({
  stopRecipeEnrichmentListener: step("enrichment"),
}));
vi.mock("@norish/queue/start-workers", () => ({ stopWorkers: step("workers") }));
vi.mock("@norish/shared-server/logger", () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@norish/shared-server/realtime/hub", () => ({ stopRealtimeHub: step("hub") }));
vi.mock("@norish/shared-server/valkey/client", () => ({ closeValkeyConnections: step("valkey") }));
vi.mock("@norish/trpc/server", () => ({ stopTrpcWebSocket: step("websocket") }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerShutdownHandlers", () => {
  it("stops every part in order on SIGTERM and exits cleanly", async () => {
    const handlers = new Map<string | symbol, () => Promise<void>>();

    // Capture the handlers instead of registering them on the test process.
    vi.spyOn(process, "on").mockImplementation(((event, handler) => {
      handlers.set(event, handler);

      return process;
    }) as typeof process.on);
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const server = {
      close: (done: (err?: Error) => void) => {
        stopped.push("http");
        done();
      },
    } as Server;

    registerShutdownHandlers(server, [{ name: "parser", run: step("parser") }]);
    await handlers.get("SIGTERM")?.();

    expect(stopped).toEqual([
      "http",
      "websocket",
      "caldav",
      "enrichment",
      "workers",
      "parser",
      "hub",
      "valkey",
    ]);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
