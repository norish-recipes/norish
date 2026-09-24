import superjson from "superjson";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import { defineRealtimeCatalogue } from "@norish/shared/contracts/realtime/catalogue";

const config = vi.hoisted(() => ({ NODE_ENV: "development" as string }));
const logged = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}));

const redis = vi.hoisted(() => {
  const client = {
    publish: vi.fn(async () => 1),
    realtimePublish: undefined as undefined | ReturnType<typeof vi.fn>,
    defineCommand: vi.fn((name: string) => {
      if (name === "realtimePublish") client.realtimePublish = vi.fn(async () => "1700000000000-0");
    }),
  };

  return client;
});

const getPublisherClient = vi.hoisted(() => vi.fn(async () => redis));

vi.mock("@norish/config/env-config-server", () => ({ SERVER_CONFIG: config }));
vi.mock("@norish/shared-server/logger", () => ({ createLogger: () => logged }));
vi.mock("@norish/shared-server/redis/client", () => ({ getPublisherClient }));

const { runWithOperationContext } = await import("@norish/shared-server/lib/operation-context");
const { defineRealtimeDomain, EVENT_ID_PLACEHOLDER, RealtimePayloadError } =
  await import("../../src/realtime/domain");

const catalogue = defineRealtimeCatalogue("grocery", {
  created: { scope: "household", payload: z.object({ ids: z.array(z.string()) }) },
  failed: { scope: "user", payload: z.object({ reason: z.string() }) },
  imported: { scope: "policy", payload: z.object({ recipeId: z.string() }) },
  announced: { scope: "broadcast", payload: z.object({ text: z.string() }) },
  becameUsable: { scope: "internal", payload: z.object({ recipeId: z.string() }) },
});

const domain = defineRealtimeDomain(catalogue);

function lastPublished(): RealtimeEventEnvelope {
  const call = redis.realtimePublish?.mock.calls.at(-1) as unknown[] | undefined;
  const bare = redis.publish.mock.calls.at(-1) as unknown[] | undefined;
  const message = (call?.[2] ?? bare?.[1]) as string;

  return superjson.parse(message);
}

beforeEach(() => {
  vi.clearAllMocks();
  config.NODE_ENV = "development";
  redis.realtimePublish = undefined;
  getPublisherClient.mockResolvedValue(redis);
});

afterEach(() => {
  config.NODE_ENV = "development";
});

describe("channel", () => {
  it("derives every scope's channel from the catalogue", () => {
    expect(domain.channel("created", { householdKey: "hh-1" })).toBe(
      "norish:grocery:household:hh-1:created"
    );
    expect(domain.channel("failed", { userId: "u-1" })).toBe("norish:grocery:user:u-1:failed");
    expect(domain.channel("announced", undefined)).toBe("norish:grocery:broadcast:announced");
    expect(domain.channel("becameUsable", undefined)).toBe("norish:grocery:internal:becameUsable");
  });

  it("routes policy: everyone → broadcast, household → household:{key}, owner → user:{id}", () => {
    const target = { householdKey: "hh-1", userId: "u-1" };

    expect(domain.channel("imported", { ...target, viewPolicy: "everyone" })).toBe(
      "norish:grocery:broadcast:imported"
    );
    expect(domain.channel("imported", { ...target, viewPolicy: "household" })).toBe(
      "norish:grocery:household:hh-1:imported"
    );
    expect(domain.channel("imported", { ...target, viewPolicy: "owner" })).toBe(
      "norish:grocery:user:u-1:imported"
    );
  });
});

describe("channelsFor", () => {
  const identity = { userId: "u-1", householdKey: "hh-1" };

  it("lists household, broadcast and user for a policy event, in that order", () => {
    expect(domain.channelsFor("imported", identity)).toEqual([
      "norish:grocery:household:hh-1:imported",
      "norish:grocery:broadcast:imported",
      "norish:grocery:user:u-1:imported",
    ]);
  });

  it("lists one channel for the other client scopes", () => {
    expect(domain.channelsFor("created", identity)).toEqual([
      "norish:grocery:household:hh-1:created",
    ]);
    expect(domain.channelsFor("failed", identity)).toEqual(["norish:grocery:user:u-1:failed"]);
    expect(domain.channelsFor("announced", identity)).toEqual([
      "norish:grocery:broadcast:announced",
    ]);
  });

  it("uses the user id as household key for a household-less user", () => {
    expect(domain.channelsFor("created", { userId: "u-1", householdKey: "u-1" })).toEqual([
      "norish:grocery:household:u-1:created",
    ]);
  });
});

describe("publish", () => {
  it("records one realtimePublish call with the stream key, MAXLEN ~ 1000 and TTL 86400", async () => {
    await domain.publish("created", { ids: ["g-1"] }, { householdKey: "hh-1" });

    expect(redis.defineCommand).toHaveBeenCalledWith(
      "realtimePublish",
      expect.objectContaining({ numberOfKeys: 2, lua: expect.stringContaining("MAXLEN") })
    );
    expect(redis.realtimePublish).toHaveBeenCalledTimes(1);
    expect(redis.realtimePublish).toHaveBeenCalledWith(
      "norish:stream:grocery:household:hh-1:created",
      "norish:grocery:household:hh-1:created",
      expect.stringContaining(`"eventId":"${EVENT_ID_PLACEHOLDER}"`),
      1000,
      86400
    );
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it("registers the script once per client", async () => {
    await domain.publish("created", { ids: ["g-1"] }, { householdKey: "hh-1" });
    await domain.publish("created", { ids: ["g-2"] }, { householdKey: "hh-1" });

    expect(redis.defineCommand).toHaveBeenCalledTimes(1);
    expect(redis.realtimePublish).toHaveBeenCalledTimes(2);
  });

  it("builds an envelope with the placeholder id, the validated payload and the resolved scope", async () => {
    await domain.publish(
      "imported",
      { recipeId: "r-1" },
      { viewPolicy: "owner", householdKey: "hh-1", userId: "u-1" }
    );

    const envelope = lastPublished();

    expect(envelope.payload).toEqual({ recipeId: "r-1" });
    expect(envelope.meta).toMatchObject({
      version: 1,
      eventId: EVENT_ID_PLACEHOLDER,
      eventName: "imported",
      namespace: "grocery",
      scope: "user",
      channel: "norish:grocery:user:u-1:imported",
    });
    expect(envelope.meta.operationId).toBeUndefined();
    expect(new Date(envelope.meta.occurredAt).toISOString()).toBe(envelope.meta.occurredAt);
  });

  it("stamps the operationId from the operation context", async () => {
    await runWithOperationContext({ operationId: "op-1" as never }, () =>
      domain.publish("created", { ids: ["g-1"] }, { householdKey: "hh-1" })
    );

    expect(lastPublished().meta.operationId).toBe("op-1");
  });

  it("publishes an internal event bare, with a UUID id and no stream call", async () => {
    await domain.publish("becameUsable", { recipeId: "r-1" }, undefined);

    expect(redis.publish).toHaveBeenCalledTimes(1);
    expect(redis.publish).toHaveBeenCalledWith(
      "norish:grocery:internal:becameUsable",
      expect.any(String)
    );
    expect(redis.defineCommand).not.toHaveBeenCalled();
    expect(redis.realtimePublish).toBeUndefined();

    const envelope = lastPublished();

    expect(envelope.meta.scope).toBe("internal");
    expect(envelope.meta.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("strips unknown payload keys through the schema", async () => {
    await domain.publish("created", { ids: ["g-1"], extra: true } as unknown as { ids: string[] }, {
      householdKey: "hh-1",
    });

    expect(lastPublished().payload).toEqual({ ids: ["g-1"] });
  });

  it("throws on an invalid payload outside production", async () => {
    config.NODE_ENV = "test";

    await expect(
      domain.publish("created", { ids: "nope" } as unknown as { ids: string[] }, {
        householdKey: "hh-1",
      })
    ).rejects.toBeInstanceOf(RealtimePayloadError);
    expect(getPublisherClient).not.toHaveBeenCalled();
  });

  it("logs and drops an invalid payload in production", async () => {
    config.NODE_ENV = "production";

    await expect(
      domain.publish("created", { ids: "nope" } as unknown as { ids: string[] }, {
        householdKey: "hh-1",
      })
    ).resolves.toBeUndefined();
    expect(logged.error).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "grocery", event: "created" }),
      expect.stringContaining("schema")
    );
    expect(getPublisherClient).not.toHaveBeenCalled();
  });

  it("never rejects on a Redis error", async () => {
    getPublisherClient.mockRejectedValueOnce(new Error("redis is down"));

    await expect(
      domain.publish("created", { ids: ["g-1"] }, { householdKey: "hh-1" })
    ).resolves.toBeUndefined();
    expect(logged.error).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "norish:grocery:household:hh-1:created" }),
      expect.any(String)
    );

    redis.defineCommand.mockImplementationOnce(() => {
      redis.realtimePublish = vi.fn(async () => {
        throw new Error("NOSCRIPT");
      });
    });

    await expect(
      domain.publish("created", { ids: ["g-1"] }, { householdKey: "hh-1" })
    ).resolves.toBeUndefined();
  });

  it("refuses an event the catalogue does not declare", async () => {
    await expect(
      (domain as unknown as { publish: (e: string) => Promise<void> }).publish("nope")
    ).rejects.toThrow(/Unknown realtime event/);
  });
});
