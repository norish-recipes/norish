import { describe, expect, it, vi } from "vitest";

import { ENVELOPE_VERSION } from "@norish/shared/contracts/realtime-envelope";

import {
  isUnauthorizedTRPCError,
  isUnauthorizedWebSocketClose,
  shouldNotifyWebSocketDisconnect,
} from "./trpc-links";
import { wrapTrpcProxy } from "./trpc-provider";

describe("createTRPCProviderBundle", () => {
  it("normalizes subscription onData values to meta and payload", () => {
    const onDataInput: unknown[] = [];
    const onData = vi.fn();
    const trpc = wrapTrpcProxy(
      {
        recipes: {
          onImported: {
            subscriptionOptions: (_input: unknown, options: unknown) => options,
          },
        },
      },
      new WeakMap()
    ) as any;

    const options = trpc.recipes.onImported.subscriptionOptions(undefined, { onData }) as any;

    const envelope = {
      meta: {
        version: ENVELOPE_VERSION,
        eventId: "evt-1",
        eventName: "imported",
        namespace: "recipes",
        scope: "household",
        channel: "norish:recipes:household:hh1:imported",
        occurredAt: "2026-03-15T00:00:00.000Z",
      },
      payload: {
        recipe: { id: "r-1" },
        pendingRecipeId: "pending-1",
      },
    };

    onData.mockImplementation((value) => {
      onDataInput.push(value);
    });

    options.onData(envelope);

    expect(onData).toHaveBeenCalledOnce();
    expect(onDataInput[0]).toEqual(envelope);
  });

  it("detects unauthorized WebSocket close reasons from React Native events", () => {
    expect(
      isUnauthorizedWebSocketClose({
        _code: 1006,
        _reason: "Received bad response code from server: 401.",
      })
    ).toBe(true);
  });

  it("detects unauthorized WebSocket close with custom 4401 code", () => {
    expect(
      isUnauthorizedWebSocketClose({
        code: 4401,
        reason: "",
      })
    ).toBe(true);
  });

  it("does not treat transient disconnects as unauthorized", () => {
    expect(
      isUnauthorizedWebSocketClose({
        _code: 1006,
        _reason: "Socket closed unexpectedly",
      })
    ).toBe(false);
  });

  it("does not treat unauthorized WebSocket closes as backend disconnects", () => {
    expect(
      shouldNotifyWebSocketDisconnect({
        _code: 1006,
        _reason: "Received bad response code from server: 401.",
      })
    ).toBe(false);
  });

  it("treats unexpected WebSocket closes as backend disconnects", () => {
    expect(
      shouldNotifyWebSocketDisconnect({
        _code: 1006,
        _reason: "Socket closed unexpectedly",
      })
    ).toBe(true);
  });

  it("detects unauthorized tRPC client errors", () => {
    expect(
      isUnauthorizedTRPCError({
        data: {
          code: "UNAUTHORIZED",
          httpStatus: 401,
        },
      })
    ).toBe(true);
  });

  it("does not treat other tRPC client errors as unauthorized", () => {
    expect(
      isUnauthorizedTRPCError({
        data: {
          code: "FORBIDDEN",
          httpStatus: 403,
        },
      })
    ).toBe(false);
  });
});
