// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@norish/shared-server/redis/client", () => ({
  getPublisherClient: vi.fn(async () => redis),
}));

// The real domain: households is the first catalogue whose payloads are
// validated at runtime by the zod schemas that always described them.
const { households } = await import("@norish/shared-server/realtime/households");

describe("household publishes validate against their zod schemas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.realtimePublish = undefined;
  });

  it("publishes a well-formed event to the household channel's stream", async () => {
    await households.publish(
      "userJoined",
      { user: { id: "u1", name: null, isAdmin: false, version: 1 } },
      { householdKey: "h1" }
    );

    expect(redis.realtimePublish).toHaveBeenCalledTimes(1);
    expect(redis.realtimePublish?.mock.calls[0]?.[1]).toBe(
      "norish:household:household:h1:userJoined"
    );
  });

  it("throws on a malformed payload outside production, so a test catches the rot", async () => {
    await expect(
      households.publish("userJoined", { user: { id: 1 } } as never, { householdKey: "h1" })
    ).rejects.toThrow(/failed its schema/);

    expect(redis.realtimePublish ?? redis.publish).not.toHaveBeenCalled();
  });
});
