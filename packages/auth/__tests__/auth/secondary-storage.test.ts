// @vitest-environment node
/**
 * Better Auth's Valkey storage against a real Valkey: the rate limiter relies on
 * `increment` being one atomic step, which a fake cannot show.
 */
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { ValkeyContainer } from "@testcontainers/valkey";
import Valkey from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { valkeySecondaryStorage as storage } from "@norish/auth/secondary-storage";
import { getValkeyConnectionOptions } from "@norish/shared-server/valkey/client";

import { VALKEY_IMAGE, valkeyUrl } from "../../../shared-server/__tests__/helpers/valkey";

const client = vi.hoisted(() => ({ valkey: null as Valkey | null }));

vi.mock("@norish/shared-server/valkey/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/valkey/client")>()),
  getPublisherClient: async () => client.valkey,
}));

let container: StartedValkeyContainer;
let valkey: Valkey;

beforeAll(async () => {
  container = await new ValkeyContainer(VALKEY_IMAGE).start();
  valkey = new Valkey(getValkeyConnectionOptions(valkeyUrl(container)));
  client.valkey = valkey;
}, 60_000);

afterAll(async () => {
  await valkey?.quit();
  await container?.stop();
});

beforeEach(async () => {
  await valkey.flushall();
});

describe("increment", () => {
  it("starts a counter at 1 with the window as its expiry", async () => {
    await expect(storage.increment("1.2.3.4|/sign-in/email", 10)).resolves.toBe(1);

    const ttl = await valkey.ttl("1.2.3.4|/sign-in/email");

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10);
  });

  it("never extends the window of a running counter", async () => {
    await storage.increment("key", 10);
    await valkey.expire("key", 3);

    await expect(storage.increment("key", 10)).resolves.toBe(2);
    expect(await valkey.ttl("key")).toBeLessThanOrEqual(3);
  });

  it("counts every one of many concurrent requests exactly once", async () => {
    const counts = await Promise.all(
      Array.from({ length: 25 }, () => storage.increment("burst", 10))
    );

    expect(counts.sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
});

describe("getAndDelete", () => {
  it("returns a value and removes it in one step", async () => {
    await storage.set("verification", "state", 60);

    await expect(storage.getAndDelete("verification")).resolves.toBe("state");
    await expect(storage.get("verification")).resolves.toBeNull();
  });

  it("returns null for a key that is not there", async () => {
    await expect(storage.getAndDelete("missing")).resolves.toBeNull();
  });
});

describe("set", () => {
  it("expires a value written with a ttl and keeps one written without", async () => {
    await storage.set("session", "a", 30);
    await storage.set("forever", "b");

    expect(await valkey.ttl("session")).toBeGreaterThan(0);
    expect(await valkey.ttl("forever")).toBe(-1);
  });
});
