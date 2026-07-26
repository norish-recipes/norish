import { EventEmitter } from "node:events";
import superjson from "superjson";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enrichRecipe = vi.fn();
const createSubscriberClient = vi.fn();

vi.mock("@norish/queue/enrichment/coordinator", () => ({ enrichRecipe }));

vi.mock("@norish/shared-server/redis/client", () => ({ createSubscriberClient }));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { RECIPE_BECAME_USABLE_CHANNEL } =
  await import("@norish/shared-server/realtime/recipe-enrichment");
const { initRecipeEnrichmentListener, stopRecipeEnrichmentListener } =
  await import("@norish/api/recipes/enrichment-listener");

class FakeSubscriber extends EventEmitter {
  subscribed: string[] = [];
  quit = vi.fn(async () => "OK");
  unsubscribe = vi.fn(async () => 1);
  subscribe = vi.fn(async (channel: string) => {
    this.subscribed.push(channel);

    return 1;
  });
}

const payload = {
  recipeId: "recipe-1",
  userId: "user-1",
  householdKey: "household-1",
  householdUserIds: ["user-1"],
};

/** Deliver a message the way the emitter publishes it: superjson-encoded. */
function deliver(subscriber: FakeSubscriber, body: unknown = payload, channel?: string) {
  subscriber.emit("message", channel ?? RECIPE_BECAME_USABLE_CHANNEL, superjson.stringify(body));
}

/** Let the listener's fire-and-forget handler settle. */
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

let subscriber: FakeSubscriber;

beforeEach(() => {
  vi.clearAllMocks();
  subscriber = new FakeSubscriber();
  createSubscriberClient.mockResolvedValue(subscriber);
  enrichRecipe.mockResolvedValue([]);
});

afterEach(async () => {
  await stopRecipeEnrichmentListener();
});

describe("initRecipeEnrichmentListener", () => {
  it("is ready only once the subscription succeeded", async () => {
    let resolveSubscribe: (() => void) | undefined;

    subscriber.subscribe.mockImplementation(
      () => new Promise<number>((resolve) => (resolveSubscribe = () => resolve(1)))
    );

    let ready = false;
    const init = initRecipeEnrichmentListener().then(() => (ready = true));

    await settle();
    expect(ready).toBe(false);

    resolveSubscribe?.();
    await init;
    expect(ready).toBe(true);
  });

  it("subscribes to the internal channel, not a permission-scoped one", async () => {
    await initRecipeEnrichmentListener();

    expect(subscriber.subscribed).toEqual([RECIPE_BECAME_USABLE_CHANNEL]);
    expect(RECIPE_BECAME_USABLE_CHANNEL).toContain("global");
  });

  it("rejects instead of reporting success when the subscription fails", async () => {
    subscriber.subscribe.mockRejectedValue(new Error("redis is down"));

    await expect(initRecipeEnrichmentListener()).rejects.toThrow("redis is down");
  });
});

describe("recipe became usable", () => {
  beforeEach(async () => {
    await initRecipeEnrichmentListener();
  });

  it("enrolls automatic enrichment for the announced recipe", async () => {
    deliver(subscriber);
    await settle();

    expect(enrichRecipe).toHaveBeenCalledWith(payload, { origin: "automatic" });
  });

  it("enrolls again on duplicate delivery, which job identity makes harmless", async () => {
    deliver(subscriber);
    deliver(subscriber);
    await settle();

    expect(enrichRecipe).toHaveBeenCalledTimes(2);
    expect(enrichRecipe).toHaveBeenNthCalledWith(2, payload, { origin: "automatic" });
  });

  it("ignores messages from other channels", async () => {
    deliver(subscriber, payload, "norish:recipe:global:somethingElse");
    await settle();

    expect(enrichRecipe).not.toHaveBeenCalled();
  });

  it("survives an unparseable message", async () => {
    subscriber.emit("message", RECIPE_BECAME_USABLE_CHANNEL, "not-json");
    await settle();

    expect(enrichRecipe).not.toHaveBeenCalled();

    deliver(subscriber);
    await settle();
    expect(enrichRecipe).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when enrollment throws, because creation already succeeded", async () => {
    enrichRecipe.mockRejectedValue(new Error("queue unavailable"));

    deliver(subscriber);

    await expect(settle()).resolves.toBeUndefined();
  });
});
