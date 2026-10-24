// @vitest-environment node
/**
 * The hub against a real Valkey whose connection goes half-open, as one does
 * when Valkey restarts behind Docker's port forwarding: the socket stays open
 * and nothing comes back. The heartbeat's PING arms the socket timeout, the
 * dead socket is dropped and reconnected, and a live iterable ends Lagged.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { ValkeyContainer } from "@testcontainers/valkey";
import Valkey from "ioredis";
import superjson from "superjson";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";

import {
  getRealtimeHub,
  HEARTBEAT_INTERVAL_MS,
  startRealtimeHub,
  stopRealtimeHub,
} from "../../src/realtime/hub";
import { closeValkeyConnections, VALKEY_SOCKET_TIMEOUT_MS } from "../../src/valkey/client";
import { freezableProxy, VALKEY_IMAGE } from "../helpers/valkey";

const config = vi.hoisted(() => ({ url: "" }));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    get VALKEY_URL() {
      return config.url;
    },
  },
}));

const CHANNEL = "norish:grocery:household:hh-1:created";

const ENVELOPE: RealtimeEventEnvelope = {
  meta: {
    version: 1,
    eventId: "1700000000000-1",
    eventName: "created",
    namespace: "grocery",
    scope: "household",
    channel: CHANNEL,
    occurredAt: "2024-01-01T00:00:00.000Z",
  },
  payload: { n: 1 },
};

let container: StartedValkeyContainer;
let proxy: ReturnType<typeof freezableProxy>;
let direct: Valkey;

beforeAll(async () => {
  container = await new ValkeyContainer(VALKEY_IMAGE).start();
  proxy = freezableProxy({ host: container.getHost(), port: container.getPort() });
  config.url = await proxy.listen();
  direct = new Valkey(container.getConnectionUrl());
});

afterAll(async () => {
  direct?.disconnect();
  await proxy?.close();
  await container?.stop();
});

it("drops a half-open subscriber after a heartbeat and ends its iterables Lagged", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });

  try {
    await startRealtimeHub();

    const iterator = getRealtimeHub().subscribe(CHANNEL)[Symbol.asyncIterator]();
    const delivered = iterator.next();

    await vi.waitFor(async () => {
      expect(await direct.pubsub("NUMSUB", CHANNEL)).toEqual([CHANNEL, 1]);
    });
    await direct.publish(CHANNEL, superjson.stringify(ENVELOPE));
    await expect(delivered).resolves.toEqual({ value: ENVELOPE, done: false });

    let ended: unknown;

    iterator.next().catch((error: unknown) => (ended = error));
    proxy.freeze();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + VALKEY_SOCKET_TIMEOUT_MS);
    await vi.waitFor(() => {
      expect(ended).toMatchObject({ name: "RealtimeLaggedError", reason: "valkey-reconnect" });
    });
  } finally {
    await stopRealtimeHub();
    await closeValkeyConnections();
    vi.useRealTimers();
  }
}, 30_000);
