import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import { ENVELOPE_VERSION } from "@norish/shared/contracts/realtime/envelope";

const enrichRecipe = vi.fn();

/** A hub that dispatches by exact channel, like the real one. */
const hub = vi.hoisted(() => {
  const handlers = new Map<string, Set<(envelope: unknown) => void>>();
  const state = { started: true };

  return {
    handlers,
    state,
    on: vi.fn((channel: string, handler: (envelope: unknown) => void) => {
      if (!state.started) throw new Error("Realtime hub is not started");

      const set = handlers.get(channel) ?? new Set();

      set.add(handler);
      handlers.set(channel, set);

      return () => {
        set.delete(handler);
      };
    }),
    emit(channel: string, envelope: unknown) {
      for (const handler of handlers.get(channel) ?? []) handler(envelope);
    },
  };
});

vi.mock("@norish/queue/enrichment/coordinator", () => ({ enrichRecipe }));

vi.mock("@norish/shared-server/realtime/hub", () => ({ getRealtimeHub: () => hub }));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { RECIPE_BECAME_USABLE_CHANNEL, initRecipeEnrichmentListener, stopRecipeEnrichmentListener } =
  await import("@norish/api/recipes/enrichment-listener");

const payload = {
  recipeId: "recipe-1",
  userId: "user-1",
  householdKey: "household-1",
  householdUserIds: ["user-1"],
};

function envelope(body: unknown, channel = RECIPE_BECAME_USABLE_CHANNEL): RealtimeEventEnvelope {
  return {
    meta: {
      version: ENVELOPE_VERSION,
      eventId: "uuid-1",
      eventName: "recipeBecameUsable",
      namespace: "recipe-enrichment",
      scope: "internal",
      channel,
      occurredAt: new Date().toISOString(),
    },
    payload: body,
  };
}

/** Deliver an envelope the way the hub does: to the handlers of its channel. */
function deliver(body: unknown = payload, channel = RECIPE_BECAME_USABLE_CHANNEL) {
  hub.emit(channel, envelope(body, channel));
}

/** Let the listener's fire-and-forget handler settle. */
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  vi.clearAllMocks();
  hub.handlers.clear();
  hub.state.started = true;
  enrichRecipe.mockResolvedValue([]);
});

afterEach(async () => {
  await stopRecipeEnrichmentListener();
});

describe("initRecipeEnrichmentListener", () => {
  it("has registered on the hub by the time it resolves", async () => {
    await initRecipeEnrichmentListener();

    expect(hub.on).toHaveBeenCalledWith(RECIPE_BECAME_USABLE_CHANNEL, expect.any(Function));
    expect(hub.handlers.get(RECIPE_BECAME_USABLE_CHANNEL)?.size).toBe(1);
  });

  it("listens on the internal channel, not a permission-scoped one", async () => {
    await initRecipeEnrichmentListener();

    expect(RECIPE_BECAME_USABLE_CHANNEL).toBe(
      "norish:recipe-enrichment:internal:recipeBecameUsable"
    );
  });

  it("rejects instead of reporting success when the hub is not started", async () => {
    hub.state.started = false;

    await expect(initRecipeEnrichmentListener()).rejects.toThrow("not started");
  });

  it("releases its registration when stopped", async () => {
    await initRecipeEnrichmentListener();
    await stopRecipeEnrichmentListener();

    expect(hub.handlers.get(RECIPE_BECAME_USABLE_CHANNEL)?.size).toBe(0);
  });
});

describe("recipe became usable", () => {
  beforeEach(async () => {
    await initRecipeEnrichmentListener();
  });

  it("enrolls automatic enrichment for the announced recipe", async () => {
    deliver();
    await settle();

    expect(enrichRecipe).toHaveBeenCalledWith(payload, { origin: "automatic" });
  });

  it("enrolls again on duplicate delivery, which job identity makes harmless", async () => {
    deliver();
    deliver();
    await settle();

    expect(enrichRecipe).toHaveBeenCalledTimes(2);
    expect(enrichRecipe).toHaveBeenNthCalledWith(2, payload, { origin: "automatic" });
  });

  it("ignores messages from other channels", async () => {
    deliver(payload, "norish:recipe-enrichment:internal:somethingElse");
    await settle();

    expect(enrichRecipe).not.toHaveBeenCalled();
  });

  it("survives a payload that fails its schema", async () => {
    deliver({ recipeId: 42 });
    await settle();

    expect(enrichRecipe).not.toHaveBeenCalled();

    deliver();
    await settle();
    expect(enrichRecipe).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when enrollment throws, because creation already succeeded", async () => {
    enrichRecipe.mockRejectedValue(new Error("queue unavailable"));

    deliver();

    await expect(settle()).resolves.toBeUndefined();
  });
});
